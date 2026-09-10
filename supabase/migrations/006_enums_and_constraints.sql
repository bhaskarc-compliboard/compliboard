-- ============================================================
-- COMPLIBOARD — MIGRATION 006: A FIXED VOCABULARY WHERE ONE WAS ONLY IMPLIED
-- ============================================================
--
-- WHY THIS EXISTS
--
-- There is not one CHECK constraint and not one ENUM type in this database. Every
-- enum-like column is plain `text` with a default and nothing constraining the value.
-- That has already cost something real, and the cost is invisible from the outside:
--
--   *** obligations.status holds `unconfirmed` in 127 of 376 rows — 34% — and that   ***
--   *** value appears in NEITHER the application code NOR the specification. The     ***
--   *** route that ranks obligations looks it up in a Record<string, number> with a  ***
--   *** `|| 9` fallback, so a third of every customer's requirement list sorts       ***
--   *** silently to the bottom. Nothing throws. Nothing logs. The page renders.      ***
--
-- That is the failure mode this migration exists to end. A `text` column is a promise
-- nobody checks: the database holds one vocabulary, the code holds another, the design
-- documents hold a third, and the three drift without anyone being told. An ENUM makes
-- the disagreement a constraint violation in the database and — once `npm run db:types`
-- regenerates lib/database.types.ts — a COMPILE ERROR in the application.
--
-- The decisions behind the vocabularies are recorded in DECISIONS.md §21.
--
-- WHY NOW, AND NOT LATER
--
-- Every conversion here rewrites a column. On the ten companies and 188 requirement rows
-- we wrote ourselves, that is instant and reversible. On a customer's data it is a
-- maintenance window. This is gate item 2 (TODO.md, top).
--
-- WHAT THIS MIGRATION DOES
--
--   1. Ten enum types, including four that no column uses yet
--   2. Six column conversions — only where production data already fits the vocabulary
--   3. companies.employee_count : text bands -> integer
--   4. The updated_at trigger, on all five tables that have the column
--
-- WHAT IT DELIBERATELY DOES NOT DO, AND WHY
--
--   requirement_templates.category    The 26 live values are three axes in one column
--                                     (subject, entity/cadence, and the shape of the
--                                     duty). The ten-value vocabulary is settled
--                                     (§21.4) but re-categorising and SPLITTING the 188
--                                     rows is chemical judgment, done by hand against a
--                                     template. The type is created here; the column
--                                     converts after that pass.
--
--   requirement_templates.layer       Three rows are `contractual`, which is not a
--                                     jurisdiction level, and three are `county` while
--                                     jurisdiction_county is NULL in all 188 rows. The
--                                     vocabulary for both is now settled (§21.2) and
--                                     both types are created here, but the six rows
--                                     still have to be EDITED before the column can
--                                     convert. See the DECIDED, PENDING THE DATA PASS
--                                     block at the foot of this file.
--
--   obligations.status                Settled (§21.3) but not converted here. `missing`
--                                     turns out not to be a status at all: it means
--                                     "applies, no evidence", which is a QUERY over
--                                     obligation_evidence rather than a stored value.
--                                     The 249 rows map to `applies` with no evidence
--                                     behind them. 007 rebuilds these rows from the
--                                     resolution engine anyway, so converting the column
--                                     here would be work 007 redoes.
--
--   calendar_events.category          All 47 rows hold `compliance`. The dropdown in
--   calendar_events.recurrence_period app/calendar/page.tsx offers ten values and
--                                     `compliance` is not among them. The stored set
--                                     and the offered set are DISJOINT — an enum built
--                                     from either one rejects everything from the
--                                     other. Needs its own decision, not a default.
--
--   audits.source_type                Assigned straight from a model response
--                                     (`sourceType = classified.type`). An enum here
--                                     converts a bad completion into a 500 on the
--                                     customer's audit. Unsafe until Zod validates the
--                                     AI boundary (TODO 2.6).
--
--   document_reviews.document_type     23 distinct values in 33 rows, model-authored,
--                                     including the same document type twice differing
--                                     only by an em-dash. It is prose, not a key. It
--                                     belongs to the Documents module (M4), which is
--                                     about making it joinable rather than constrained.
--
--   entities.entity_type              Zero rows, and migration 007 drops and recreates
--                                     this table with entity_scope from the start.
--                                     Converting it here is work 007 undoes.
--
-- ORDER MATTERS INSIDE THIS FILE. Every defaulted column has its DEFAULT dropped before
-- the type change and re-added afterwards, because a `text` default cannot survive an
-- ALTER TYPE to an enum. Getting that wrong fails loudly, which is the good case; what
-- follows is written so it does not fail at all.
--
-- SAFE TO RE-RUN. Every statement is guarded.
-- ============================================================


-- ------------------------------------------------------------
-- 1. THE TYPES
--
-- Ten types. Six are used by a column below; four exist without a column yet, because
-- the vocabulary is settled even where the data pass that fits the rows to it is not.
-- Creating them now means the generated TypeScript carries them from today, so the code
-- that has to change can be written against the real names rather than string literals.
--
-- `create type` has no IF NOT EXISTS, so each is guarded by a catalog check.
-- ------------------------------------------------------------

do $$
begin
  -- --- used by a column in this migration ---

  -- requirement_templates.applies — is this row universal, or gated on a switch?
  -- 182 of 188 are conditional. Applicability determination IS the product.
  if not exists (select 1 from pg_type where typname = 'applies_mode') then
    create type public.applies_mode as enum ('conditional', 'universal');
  end if;

  -- requirement_templates.entity_type — what the requirement attaches to.
  -- `product` is new (BUILD-PLAN 2.7): cannabis per-SKU pre-approval needs it.
  if not exists (select 1 from pg_type where typname = 'entity_scope') then
    create type public.entity_scope as enum
      ('organization', 'site', 'chemical', 'equipment', 'person', 'product');
  end if;

  -- requirement_templates.priority
  if not exists (select 1 from pg_type where typname = 'requirement_priority') then
    create type public.requirement_priority as enum ('critical', 'high', 'standard');
  end if;

  -- requirement_templates.status — how far a library row has got through verification.
  -- All 188 rows are `generated` today. `verified` is set by a human and only by a
  -- human (CLAUDE.md §4): the worker may never write it.
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type public.verification_status as enum ('generated', 'disputed', 'verified');
  end if;

  -- checklist_items.category
  if not exists (select 1 from pg_type where typname = 'checklist_item_category') then
    create type public.checklist_item_category as enum ('must_do', 'good_to_have');
  end if;

  -- company_folders.section
  if not exists (select 1 from pg_type where typname = 'folder_section') then
    create type public.folder_section as enum ('files', 'hr', 'log');
  end if;

  -- --- created now, no column uses them yet (see the header) ---

  -- DECISIONS.md §21.2. Jurisdiction, and nothing else.
  --
  -- `local` is NOT `city`. It means "the authority having jurisdiction, resolved per
  -- site" — a city fire marshal, a county fire marshal, or a rural fire protection
  -- district, and Oregon has many of the last. Which one applies depends on the address
  -- and cannot be known from the requirement row, so `local` is the honest value rather
  -- than a placeholder. It is also the first place in the library where a company-wide
  -- answer is simply WRONG: two plants of one company can sit under different fire
  -- authorities, which is the same fact behind DECISIONS.md §20 and TODO.md 1.6.
  --
  -- The column that eventually uses this type is NULLABLE, deliberately. Three rows are
  -- contractual (ISO 9001, ISO 14001, NACD) and have no jurisdiction at all; forcing
  -- them to `federal` would assert that US federal law requires ISO 9001, which is
  -- false. source_type = contractual with layer = NULL is the only pairing that reads
  -- correctly.
  if not exists (select 1 from pg_type where typname = 'jurisdiction_layer') then
    create type public.jurisdiction_layer as enum
      ('federal', 'state', 'county', 'city', 'local');
  end if;

  -- DECISIONS.md §21.2. Who imposed the duty — the axis `contractual` was hiding in.
  -- A contractual obligation still has a jurisdiction; it just has no legislature.
  if not exists (select 1 from pg_type where typname = 'requirement_source_type') then
    create type public.requirement_source_type as enum ('statutory', 'contractual');
  end if;

  -- DECISIONS.md §21.3. Four states, from CLAUDE.md §3.2.
  --
  -- These four answer ONE question: DOES THIS APPLY TO ME? They do not answer "have I
  -- done it" — that is a JOIN against obligation_evidence and never a column value.
  -- The state was called `satisfied` for half a day and renamed before anything used
  -- it, because the name answered the second question while the column answers the
  -- first, and a row reading `satisfied` with no evidence behind it is a false green of
  -- exactly the kind CLAUDE.md §6 names. `applies` / `does_not_apply` is also a clean
  -- opposition; `satisfied` / `does_not_apply` was two different axes.
  --
  -- `at_risk` and `expiring_soon` are deliberately absent for the same reason: they are
  -- DERIVED from evidence expiry, and a stored copy of a derived value is the stale flag
  -- that lets an expired certificate keep passing.
  if not exists (select 1 from pg_type where typname = 'obligation_status') then
    create type public.obligation_status as enum
      ('applies', 'does_not_apply', 'undetermined', 'unknown');
  end if;

  -- DECISIONS.md §21.4. The SHAPE of the duty — what kind of thing you must do.
  -- Subject matter belongs to agency_id; entity and cadence are already their own
  -- columns. This is the axis with no other home.
  if not exists (select 1 from pg_type where typname = 'obligation_type') then
    create type public.obligation_type as enum (
      'permit',            -- incl. pre-approval regimes; cadence carries `pre_approval`
      'written_program',
      'training',
      'recordkeeping',
      'monitoring',
      'reporting',
      'physical_control',
      'certification',     -- an ORGANISATION's — ISO 9001, NACD
      'credential',        -- a PERSON's — CDL hazmat endorsement, first aid/CPR
      'fees_taxes'
    );
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. THE SIX COLUMN CONVERSIONS
--
-- Only columns whose production data already fits the vocabulary exactly. Each was
-- checked against a distinct-value count first; the counts are recorded beside each so
-- a future reader can see what the data looked like when the decision was made, and
-- the ABORT GUARDS below re-check it at apply time rather than trusting this comment.
--
-- Pattern for every one: drop default -> alter type with an explicit cast -> re-add the
-- default, now typed. A `text` default does not survive the type change.
-- ------------------------------------------------------------

-- --- ABORT GUARDS -------------------------------------------
-- If any column holds a value outside its new vocabulary, stop before altering
-- anything. `alter type` would fail on its own, but it would fail partway through a
-- file that has already changed other tables. Better to refuse at the start with a
-- message that says which value and how many rows.
do $$
declare
  bad_count integer;
  bad_list  text;
begin
  select count(*), string_agg(distinct v, ', ')
    into bad_count, bad_list
  from (
    select applies::text      as v from public.requirement_templates
      where applies not in ('conditional','universal')
    union all
    select entity_type::text      from public.requirement_templates
      where entity_type not in ('organization','site','chemical','equipment','person','product')
    union all
    select priority::text         from public.requirement_templates
      where priority is not null and priority not in ('critical','high','standard')
    union all
    select status::text           from public.requirement_templates
      where status is not null and status not in ('generated','disputed','verified')
    union all
    select category::text         from public.checklist_items
      where category not in ('must_do','good_to_have')
    union all
    select section::text          from public.company_folders
      where section not in ('files','hr','log')
  ) x;

  if bad_count > 0 then
    raise exception
      'MIGRATION 006 ABORTED: % row(s) hold values outside the new vocabularies: %. Fix the data, then re-run.',
      bad_count, bad_list;
  end if;
end $$;

-- 2.1 requirement_templates.applies       conditional 182 · universal 6 · null 0
alter table public.requirement_templates alter column applies drop default;
alter table public.requirement_templates
  alter column applies type public.applies_mode using applies::public.applies_mode;
alter table public.requirement_templates
  alter column applies set default 'universal'::public.applies_mode;

-- 2.2 requirement_templates.entity_type   organization 98 · chemical 27 · equipment 23
--                                         · person 23 · site 17 · null 0
--     `product` is in the type and in no row yet. That is intended.
alter table public.requirement_templates alter column entity_type drop default;
alter table public.requirement_templates
  alter column entity_type type public.entity_scope using entity_type::public.entity_scope;
alter table public.requirement_templates
  alter column entity_type set default 'organization'::public.entity_scope;

-- 2.3 requirement_templates.priority      high 96 · critical 62 · standard 30 · null 0
alter table public.requirement_templates alter column priority drop default;
alter table public.requirement_templates
  alter column priority type public.requirement_priority
  using priority::public.requirement_priority;
alter table public.requirement_templates
  alter column priority set default 'high'::public.requirement_priority;

-- 2.4 requirement_templates.status        generated 188 · null 0
--     Column is nullable and stays nullable: nothing here decides that a library row
--     must have a verification status, and NOT NULL is a separate argument.
alter table public.requirement_templates alter column status drop default;
alter table public.requirement_templates
  alter column status type public.verification_status
  using status::public.verification_status;
alter table public.requirement_templates
  alter column status set default 'generated'::public.verification_status;

-- 2.5 checklist_items.category            must_do 215 · good_to_have 20 · null 0
--     NOT NULL already, no default.
alter table public.checklist_items
  alter column category type public.checklist_item_category
  using category::public.checklist_item_category;

-- 2.6 company_folders.section             files 53 · hr 20 · log 12 · null 0
--
--     NOTE for whoever reads this next: /api/folders POST does not pass `section`
--     through — app/documents/page.tsx sends it and the route never destructures it, so
--     every folder created through the UI takes the column default. That is a real bug
--     and it is NOT fixed here, because fixing it would start letting caller-supplied
--     values reach a newly-constrained column in the same migration that constrains it.
--     One change at a time. Recorded in TODO.md §0.7.
alter table public.company_folders alter column section drop default;
alter table public.company_folders
  alter column section type public.folder_section using section::public.folder_section;
alter table public.company_folders
  alter column section set default 'files'::public.folder_section;


-- ------------------------------------------------------------
-- 3. companies.employee_count : text bands -> integer
--
-- DECISIONS.md §21.1. Every employment threshold in the library is a NUMBER — Oregon
-- sick time at 10, OFLA at 25, FMLA at 50, EEO-1 and WARN at 100 — and every band the
-- app offers straddles one of them:
--
--     '1-25'   crosses 10, and lands exactly on 25
--     '26-75'  crosses 50
--     '76-200' crosses 100
--
-- A company stored as '26-75' cannot be resolved for FMLA. The answer is not in the
-- data and no downstream logic recovers it. Bands are a rendering choice; they can be
-- computed from a number at any time. A number cannot be computed from a band.
--
-- WHAT THIS DESTROYS, SAID OUT LOUD: all ten existing values. Eight hold a band, two
-- hold an empty string (app/signup/page.tsx hardcodes employeeCount: '' on every
-- account it creates). A band cannot become a number without inventing one, so every
-- row becomes NULL. All ten companies are our own test data — CB-Test-1, CB-Test-2,
-- ZZ Throwaway Test. Doing this after a real customer exists would mean asking them to
-- re-enter it.
--
-- Nullable, deliberately: "we have not been told yet" is a real and common state, and
-- it is what an undetermined switch reads. A NOT NULL with a made-up default would be
-- a false green of exactly the kind CLAUDE.md §6 names.
-- ------------------------------------------------------------

alter table public.companies
  alter column employee_count type integer
  using (case when employee_count ~ '^[0-9]+$'
              then employee_count::integer
              else null end);
--        ^ Only an already-numeric string converts. A band does NOT: reading '26-75'
--          as 26 would invent a number the customer never gave, and 26 vs 75 is the
--          difference between FMLA applying and not. NULL is the truthful answer.

comment on column public.companies.employee_count is
  'Headcount as an integer, never a band. Thresholds in the requirement library are '
  'numbers (10 Oregon sick time, 25 OFLA, 50 FMLA, 100 EEO-1/WARN) and a band straddles '
  'them. Band at render time if a screen wants bands. NULL means not yet told. '
  'DECISIONS.md §21.1.';


-- ------------------------------------------------------------
-- 4. THE updated_at TRIGGER
--
-- Carried in TODO.md §0.7 since 9 September. Five tables have an `updated_at` column;
-- all five default it to now() on INSERT and NOTHING has ever advanced it since,
-- because there are no triggers in `public` and no application code sets it. So the
-- column reads as "last modified" and actually means "created" — a field that looks
-- like an answer and is not one.
--
-- (CURRENT-SCHEMA.md calls these "the nine updated_at columns". There are five. That
-- line is wrong and is corrected here rather than propagated.)
--
-- This matters more once library rows are versioned: "when did this row last change"
-- is part of the audit trail a customer is paying for.
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker           -- runs as the caller; it touches only the row being written
set search_path = ''       -- pinned, same discipline as auth_company_id()
as $$
begin
  new.updated_at = now();
  return new;
end $$;

comment on function public.set_updated_at is
  'Advances updated_at on UPDATE. Attached to every table carrying the column. '
  'Before this existed the column defaulted on INSERT and never moved again.';

do $$
declare
  t text;
begin
  foreach t in array array[
    'agencies', 'entities', 'obligations', 'requirement_templates', 'standard_templates'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()', t);
  end loop;
end $$;


-- ============================================================
-- DECIDED, PENDING THE DATA PASS
--
-- Six rows in requirement_templates block the `layer` conversion. Both questions were
-- answered on 10 September (DECISIONS.md §21.2). The rows themselves still have to be
-- edited by hand — chemical judgment, done against a template — and the column converts
-- after that, not here.
--
-- A. THREE FIRE-CODE ROWS BECOME layer = 'local'.
--
--      · Fire-code hazardous-material permits
--        2022 Oregon Fire Code §§ 105, 5001.5.2 and applicable Chapters 50-67
--      · Chemical storage compatibility / segregation
--        Oregon Fire Code (IFC-based) Ch. 50
--      · Emergency lighting / exit sign testing
--        OFC / NFPA 101
--
--    They currently say `county` while jurisdiction_county is NULL in all 188 rows —
--    claiming a county and naming none. `local` is the right value and `city` is not:
--    a rural fire protection district is not a city, and Oregon has many of them. The
--    enforcing authority depends on the site's address and cannot be written on the
--    requirement row at all.
--
--    *** These three are the first rows in the library that CANNOT be resolved at    ***
--    *** company level. Two plants of one company can sit under different fire       ***
--    *** authorities, so a `local` row resolves per site or not at all. That is the  ***
--    *** same fact behind DECISIONS.md §20 and TODO.md 1.6, arriving here as a       ***
--    *** correctness requirement rather than a convenience.                          ***
--
-- B. THREE CONTRACTUAL ROWS BECOME source_type = 'contractual', layer = NULL.
--
--      · ISO 9001 certificate maintained          (Registrar contract rules)
--      · ISO 14001 certificate maintained         (Registrar contract rules)
--      · NACD Responsible Distribution verification (NACD membership terms)
--
--    All three carry jurisdiction_state = NULL. Defaulting them to `federal` would
--    assert that US federal law requires ISO 9001, which is false. A registrar contract
--    is not territorial, so `layer` is nullable and these three are why.
--
-- Until the data pass runs, `layer` stays text and `source_type` is a type with no
-- column. Nothing in this migration touches those six rows.
-- ============================================================
