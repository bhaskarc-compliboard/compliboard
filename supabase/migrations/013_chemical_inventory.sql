-- ============================================================
-- COMPLIBOARD — MIGRATION 013: THE CHEMICAL INVENTORY, AND THREE SPLITS
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Four switches in the library are not facts. They are stand-ins for a calculation the
-- schema cannot do.
--
--   tier2_epcra_threshold   "OSHA hazardous chemical >= 10,000 lb, or EHS at the lower of
--                            500 lb or its TPQ"
--   ehs_above_tpq           "EHS present at or above TPQ"  — a different TPQ per substance
--   or_cr2k_threshold       "5 gal liquid, 10 lb solid, 20 ft3 gas"  — three units
--   psm_rmp_threshold       "Appendix A threshold, or >= 10,000 lb covered flammable"
--   tri_reportable          "25,000 lb manufactured/processed, 10,000 lb otherwise used,
--                            with lower PBT/PFAS thresholds"
--
-- EVERY ONE IS PER SUBSTANCE. A site holding 9,000 lb each of five different hazardous
-- chemicals is BELOW the threshold on every one of them and reports nothing — which is
-- correct under EPCRA, and is only expressible if the system knows the quantities. Today
-- the product would have to answer that with a boolean, and a boolean set to `false` does
-- not read as "we could not calculate this". It reads as DETERMINED NOT TO APPLY.
--
-- CR2K cannot even be summed: gallons, pounds and cubic feet are three dimensions.
--
-- WHY NOT ONE SWITCH PER SUBSTANCE. DECISIONS.md §23.1 decomposed
-- substance_exposure_above_action_level into 14 switches because the library holds exactly
-- 14 substance standards — a CLOSED set. EPCRA's list is hundreds of entries and changes;
-- TRI's is hundreds more. §23.1's own reversal condition anticipates this case: an array is
-- right when applies_expression never needs to look inside, and here it always does.
--
-- WHAT THIS REPLACES, AND WHAT IT DOES NOT
--
--   REPLACES: the four boolean stand-ins above. They become computed, not asked.
--
--   DOES NOT REPLACE: the fourteen exposure_* switches. Those are about AIRBORNE
--   CONCENTRATION at a worker's breathing zone — 30 µg/m3 of lead as an 8-hour TWA — and
--   are established by air sampling. This table is about QUANTITY HELD ON SITE, established
--   by an inventory. A site can hold 50,000 lb of a substance in sealed drums with zero
--   airborne exposure, and can exceed an action level while holding almost nothing.
--   KEEPING BOTH IS NOT DUPLICATION. They answer different questions for different
--   regulators, and confusing them would produce a respirator programme for a warehouse.
--
-- THE REACH IS WIDER THAN THE FIVE RULES. Also gated on what a site actually holds:
-- HazCom, chemical storage segregation, the SDS file, DEA List I, FIFRA, hazardous-waste
-- determination, and the EPCRA release-notification pair. Thirty-plus rows collapse onto
-- one table.
--
-- WHAT THIS MIGRATION DOES
--   1. regulated_substances — the FEDERAL LISTS, by CAS. Reference data, not company data.
--   2. company_chemicals    — what one site holds. Tenant data, mirrors company_switches.
--   3. substance_inventory() — the function applies_expression calls.
--   4. Three under-decomposed requirement rows split.
-- ============================================================


-- ------------------------------------------------------------
-- 0. TWO ENUMS
--
-- Postgres ENUM rather than TEXT + CHECK, per CLAUDE.md §3.7 — `alter type … add value`
-- avoids the drop-and-recreate churn that requires restating every prior value.
--
-- `chemical_unit` has no litres or kilograms on purpose: every threshold the library names
-- is imperial or cubic feet, and adding a unit nothing compares against would invite a
-- quantity that silently fails every comparison.
-- ------------------------------------------------------------

create type public.chemical_unit  as enum ('lb', 'gal', 'ft3');
create type public.chemical_state as enum ('solid', 'liquid', 'gas');

comment on type public.chemical_unit is
  'Pounds, gallons, cubic feet. Oregon CR2K uses all three in one rule — 5 gal liquid, '
  '10 lb solid, 20 ft3 gas — which is why quantity cannot be a single number.';


-- ------------------------------------------------------------
-- 1. regulated_substances — THE LISTS, NOT THE COMPANY
--
-- The thresholds belong to the SUBSTANCE, not to the company holding it. Putting
-- `is_ehs` or a TPQ on a company's row means every customer carries their own copy of a
-- federal list, and updating that list means touching every customer. Here it is one row
-- per substance, and a list change is one UPDATE.
--
-- KEYED BY CAS NUMBER, NOT BY NAME. "Isopropanol", "isopropyl alcohol" and "IPA" are one
-- substance; 67-63-0 is one string. Every federal list — EPCRA Appendix A, the TRI list,
-- PSM Appendix A — is published by CAS. Matching on names is the string-search failure
-- §23.1 rejected, wearing a different costume.
-- ------------------------------------------------------------

create table public.regulated_substances (
  cas_number            text primary key,
  name                  text not null,
  synonyms              text[] not null default '{}',

  -- Membership and thresholds, per list. NULL means "not on this list", which is different
  -- from zero — zero would mean "on the list with no threshold", i.e. any quantity triggers.
  is_ehs                boolean not null default false,
  ehs_tpq_lb            numeric,          -- EPCRA §302 threshold planning quantity
  is_tri_listed         boolean not null default false,
  tri_manufacture_lb    numeric,          -- generally 25,000; lower for PBT/PFAS
  tri_otherwise_used_lb numeric,          -- generally 10,000
  is_psm_listed         boolean not null default false,
  psm_threshold_lb      numeric,          -- 29 CFR 1910.119 Appendix A
  is_rmp_listed         boolean not null default false,
  rmp_threshold_lb      numeric,
  cercla_rq_lb          numeric,          -- reportable quantity
  is_dea_list_i         boolean not null default false,

  -- Provenance, because a threshold nobody checked is the same problem as a requirement
  -- nobody checked. AUDIT-CHECKS.md check 1 exists for exactly this.
  source_list           text,
  source_url            text,
  source_checked_at     timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- A substance on a list with no threshold is a modelling error that reads as harmless:
  -- the join finds it and compares against NULL, which is NULL, and the CHECK that would
  -- have caught it never fires. CLAUDE.md §3.7.
  constraint regulated_substances_ehs_has_tpq check (not is_ehs or ehs_tpq_lb is not null),
  constraint regulated_substances_psm_has_threshold check (not is_psm_listed or psm_threshold_lb is not null),
  constraint regulated_substances_rmp_has_threshold check (not is_rmp_listed or rmp_threshold_lb is not null),
  -- CAS numbers are dddddd-dd-d, up to 7 leading digits today. Format-checked because a
  -- mistyped CAS silently matches nothing, which reads as "not regulated".
  constraint regulated_substances_cas_format check (cas_number ~ '^[0-9]{2,7}-[0-9]{2}-[0-9]$')
);

comment on table public.regulated_substances is
  'The federal lists, keyed by CAS. Reference data: identical for every customer, so the '
  'thresholds live here once rather than on each company row. NULL threshold means not on '
  'that list — not "no threshold". Migration 013.';


-- ------------------------------------------------------------
-- 2. company_chemicals — WHAT ONE SITE HOLDS
--
-- Mirrors company_switches deliberately: source, confidence, basis, expires_at,
-- user_locked, scoped to a site. A chemical inventory is a DETERMINED FACT with a basis,
-- and it goes stale exactly like a switch does — DECISIONS.md §38.1, where the same
-- reasoning made the exposure switches annual rather than static.
--
-- SITE-SCOPED AND NOT NULL, unlike company_switches which allows either. Inventory is
-- always a property of a place: EPCRA reports per facility, CR2K reports per facility, and
-- a company-wide chemical total is not a quantity any regulator asks about.
-- ------------------------------------------------------------

create table public.company_chemicals (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  entity_id         uuid not null references public.entities(id) on delete cascade,

  -- The CAS is the join to regulated_substances. NULLABLE, deliberately: a company can
  -- tell us it holds "parts washer solvent" before anybody has identified it, and an
  -- unidentified chemical present is a more useful fact than no row at all. It resolves to
  -- unknown rather than to absent — CLAUDE.md §3.2.
  cas_number        text references public.regulated_substances(cas_number) on delete restrict,
  substance_name    text not null,

  max_quantity      numeric,
  unit              public.chemical_unit,
  physical_state    public.chemical_state,

  source            public.switch_value_source,
  confidence        public.switch_confidence,
  basis             text,
  determined_at     timestamptz,
  expires_at        timestamptz,
  user_locked       boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- One row per substance per site. NULLS NOT DISTINCT so two unidentified rows with the
  -- same name collide rather than both existing — the federal-layer lesson from
  -- migration 011's agency uniqueness.
  constraint company_chemicals_one_per_site
    unique nulls not distinct (entity_id, cas_number, substance_name),

  -- A quantity without a unit is not a quantity. 10,000 of what?
  constraint company_chemicals_quantity_has_unit check (
    (max_quantity is null and unit is null) or (max_quantity is not null and unit is not null)
  ),
  constraint company_chemicals_quantity_not_negative check (max_quantity is null or max_quantity >= 0)
);

create index idx_company_chemicals_company on public.company_chemicals (company_id);
create index idx_company_chemicals_entity  on public.company_chemicals (entity_id);
create index idx_company_chemicals_cas     on public.company_chemicals (cas_number);
create index idx_company_chemicals_expiry  on public.company_chemicals (company_id, expires_at)
  where expires_at is not null;

comment on table public.company_chemicals is
  'What one SITE holds, by CAS where identified. Tenant data. Replaces four boolean switches '
  'that were stand-ins for a per-substance calculation: a site with 9,000 lb each of five '
  'chemicals is below every threshold and reports nothing, which is correct and is not '
  'expressible as a boolean. Does NOT replace the exposure_* switches, which are airborne '
  'concentration rather than quantity held. Migration 013.';


-- ------------------------------------------------------------
-- 3. GRANTS AND POLICIES
--
-- *** NOT GRANTING IS NOT DENYING *** — CLAUDE.md §3.6. This project carries default
-- privileges on `public` that hand anon, authenticated and service_role full DML on ANY new
-- table before a single GRANT runs. Migration 008 was refused by its own verification for
-- exactly this. Every table below is revoked from anon explicitly, and the reference table
-- is revoked from authenticated for writes.
-- ------------------------------------------------------------

alter table public.regulated_substances enable row level security;
alter table public.company_chemicals    enable row level security;

revoke all on public.regulated_substances from anon;
revoke all on public.company_chemicals    from anon;
-- Reference data: readable by anyone signed in, written only by the service role.
revoke insert, update, delete on public.regulated_substances from authenticated;
grant select on public.regulated_substances to authenticated;
grant select, insert, update, delete on public.company_chemicals to authenticated;

create policy "regulated_substances readable by authenticated users"
  on public.regulated_substances for select to authenticated using (true);

-- Tenancy through auth_company_id(), never a re-derived subquery — CLAUDE.md §3.6.
create policy company_chemicals_select on public.company_chemicals
  for select to authenticated using (company_id = public.auth_company_id());
create policy company_chemicals_insert on public.company_chemicals
  for insert to authenticated with check (company_id = public.auth_company_id());
create policy company_chemicals_update on public.company_chemicals
  for update to authenticated using (company_id = public.auth_company_id())
                                 with check (company_id = public.auth_company_id());
create policy company_chemicals_delete on public.company_chemicals
  for delete to authenticated using (company_id = public.auth_company_id());

create trigger set_updated_at before update on public.regulated_substances
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.company_chemicals
  for each row execute function public.set_updated_at();


-- ------------------------------------------------------------
-- 4. substance_inventory() — THE FUNCTION applies_expression CALLS
--
-- One function, four questions, because all four are the same shape: does this site hold
-- ANY ONE substance at or above ITS OWN threshold on a given list?
--
-- *** THE `ANY ONE` IS THE ENTIRE POINT. *** It is an EXISTS over the site's inventory, not
-- a sum. A site with 9,000 lb each of five chemicals returns false, correctly. A site with
-- one drum of a substance whose TPQ is 100 lb returns true.
--
-- RETURNS boolean, and NULL WHEN THE INVENTORY IS UNKNOWN — which is the property that
-- matters most. CLAUDE.md §3.2: absence of evidence must never produce a clear. A site with
-- no inventory rows has not been determined to be below the threshold; it has not been
-- asked. NULL propagates through the expression evaluator to `unknown`, and `unknown` shows
-- as an open question rather than as a clear.
--
-- SECURITY INVOKER and `set search_path = ''`: it reads tenant data and must run under the
-- caller's policies rather than around them.
-- ------------------------------------------------------------

create or replace function public.substance_inventory(
  p_entity_id uuid,
  p_list      text          -- 'ehs' | 'tri' | 'psm' | 'rmp' | 'cercla' | 'dea_list_i'
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    -- Nothing recorded for this site: UNKNOWN, not false. The difference is the whole
    -- safety property.
    when not exists (select 1 from public.company_chemicals c where c.entity_id = p_entity_id)
      then null
    else exists (
      select 1
        from public.company_chemicals c
        join public.regulated_substances r on r.cas_number = c.cas_number
       where c.entity_id = p_entity_id
         and c.max_quantity is not null
         and c.unit = 'lb'::public.chemical_unit
         and case p_list
               when 'ehs'        then r.is_ehs        and c.max_quantity >= r.ehs_tpq_lb
               when 'tri'        then r.is_tri_listed and c.max_quantity >= least(
                                        coalesce(r.tri_manufacture_lb, 'infinity'::numeric),
                                        coalesce(r.tri_otherwise_used_lb, 'infinity'::numeric))
               when 'psm'        then r.is_psm_listed and c.max_quantity >= r.psm_threshold_lb
               when 'rmp'        then r.is_rmp_listed and c.max_quantity >= r.rmp_threshold_lb
               when 'cercla'     then r.cercla_rq_lb is not null and c.max_quantity >= r.cercla_rq_lb
               when 'dea_list_i' then r.is_dea_list_i
               else false
             end)
  end
$$;

comment on function public.substance_inventory is
  'Does this SITE hold ANY ONE substance at or above ITS OWN threshold on the named list? '
  'An EXISTS, never a sum — a site with 9,000 lb each of five chemicals is below every '
  'threshold and reports nothing, which is correct under EPCRA. Returns NULL when the site '
  'has no inventory recorded: not determined to be below, merely not asked. CLAUDE.md §3.2.';


-- ------------------------------------------------------------
-- 5. VERIFY — BY VIOLATION
-- ------------------------------------------------------------

do $$
declare co uuid; ent uuid; r boolean;
begin
  begin
    insert into public.regulated_substances (cas_number, name, is_ehs)
    values ('7664-93-9', 'Test EHS no TPQ', true);
    raise exception 'MIGRATION 013 FAILED: an EHS substance with no TPQ was accepted. The join would compare against NULL and the threshold would never fire.';
  exception when check_violation then null;
  end;

  begin
    insert into public.regulated_substances (cas_number, name) values ('not-a-cas', 'Test');
    raise exception 'MIGRATION 013 FAILED: a malformed CAS number was accepted. A mistyped CAS matches nothing, which reads as "not regulated".';
  exception when check_violation then null;
  end;

  select id into co from public.companies limit 1;
  select id into ent from public.entities where company_id = co and is_primary limit 1;

  if co is not null and ent is not null then
    begin
      insert into public.company_chemicals (company_id, entity_id, substance_name, max_quantity)
      values (co, ent, '__mig013__', 500);
      raise exception 'MIGRATION 013 FAILED: a quantity with no unit was accepted. 500 of what?';
    exception when check_violation then null;
    end;

    -- THE POSITIVE CONTROL, and the property that matters: an empty inventory is UNKNOWN.
    r := public.substance_inventory(ent, 'ehs');
    if r is not null then
      raise exception 'MIGRATION 013 FAILED: substance_inventory returned % for a site with no inventory. It must return NULL — a site that has not been asked is not a site determined to be below the threshold.', r;
    end if;

    -- And a well-formed pair must be accepted and must evaluate.
    begin
      insert into public.regulated_substances (cas_number, name, is_ehs, ehs_tpq_lb)
      values ('7782-50-5', '__mig013__ chlorine', true, 100);
      insert into public.company_chemicals (company_id, entity_id, cas_number, substance_name, max_quantity, unit)
      values (co, ent, '7782-50-5', '__mig013__ chlorine', 250, 'lb');
      if public.substance_inventory(ent, 'ehs') is not true then
        raise exception 'MIGRATION 013 FAILED: 250 lb against a 100 lb TPQ did not return true.';
      end if;
      -- and below threshold must be false, not null
      update public.company_chemicals set max_quantity = 50 where substance_name = '__mig013__ chlorine';
      if public.substance_inventory(ent, 'ehs') is not false then
        raise exception 'MIGRATION 013 FAILED: 50 lb against a 100 lb TPQ did not return false.';
      end if;
      delete from public.company_chemicals where substance_name = '__mig013__ chlorine';
      delete from public.regulated_substances where cas_number = '7782-50-5';
    exception when others then
      delete from public.company_chemicals where substance_name = '__mig013__ chlorine';
      delete from public.regulated_substances where cas_number = '7782-50-5';
      raise exception 'MIGRATION 013 FAILED in the positive control: %', sqlerrm;
    end;
  end if;

  if exists (select 1 from public.regulated_substances where name like '__mig013__%')
     or exists (select 1 from public.company_chemicals where substance_name like '__mig013__%') then
    raise exception 'MIGRATION 013 FAILED: test rows survived.';
  end if;

  raise notice 'MIGRATION 013 OK: inventory tables created, 3 illegal writes refused, empty inventory returns NULL, a real threshold evaluates both ways.';
end $$;


-- ============================================================
-- 6. THREE UNDER-DECOMPOSED ROWS, SPLIT
--
-- The signal is the one the silica split was found by: ONE ROW, SEVERAL INDEPENDENT CLOCKS
-- AND SEVERAL DISTINCT ARTIFACTS. A row like that can only ever produce one obligation with
-- one status, so a company fully compliant on one half and absent on the other reads as a
-- single ambiguous "needs work" — and a plant manager learns nothing from it.
--
-- ONE ROW CANNOT CARRY TWO STATUSES. That is the whole argument, and it is the same one
-- that split the boiler row into registration, operating certificate and periodic
-- inspection.
--
-- The parent is RETIRED, never deleted (CLAUDE.md §3.2) — effective_to set, children carry
-- split_from_id, and an audit pinned to the parent stays reproducible.
--
-- *** NOTE FOR WHOEVER RELOADS THE LIBRARY: THIS IS THE FIRST TIME requirement_templates
-- DIVERGES FROM supabase/seed-data/REQUIREMENTS-FILLED-2026-09-11.xlsx. *** The six existing
-- split children came from the worksheet's own `split_from` column. These nine do not.
-- `scripts/load-requirements.js` refuses a populated table without --replace, so nothing
-- will silently undo this — but the worksheet is no longer a complete source, and which of
-- the two is authoritative now needs deciding. TODO 6.3c.
-- ============================================================

do $$
declare
  parent_id uuid;
  osha_agency uuid;
begin
  select id into osha_agency from public.agencies where short_name = 'OR-OSHA';

  -- ----------------------------------------------------------
  -- SPLIT 1 — Electronic OSHA injury-data submission
  --
  -- "20-249 in listed industries submit 300A; 100+ in Appendix B submit 300/301; 250+
  --  recordkeeping establishments submit 300A."
  --
  -- THREE thresholds, THREE different form sets, THREE ways to be wrong. A 300-person
  -- establishment owes 300A; a 150-person Appendix B establishment owes 300 AND 301, which
  -- is a different filing with different content. One row cannot say which of those a
  -- company has done.
  --
  -- NOTE the sibling row, `OSHA injury and illness log`, is NOT touched: keeping the log
  -- (>10 employees) is already a separate row and is already correct. The log and its
  -- electronic submission are two obligations and the library already had that right.
  -- ----------------------------------------------------------
  select id into parent_id from public.requirement_templates
   where requirement_name = 'Electronic OSHA injury-data submission' and effective_to is null;

  if parent_id is not null then
    update public.requirement_templates set effective_to = current_date where id = parent_id;

    insert into public.requirement_templates
      (requirement_name, split_from_id, agency_id, category, entity_type, source_type,
       jurisdiction_layer, jurisdiction_state, industries, citation, applies,
       trigger_condition, trigger_plain, cadence, evidence_description, fails_if,
       priority, status, generated_by, effective_from)
    values
      ('Electronic submission of Form 300A — 20-249 employees, listed industry', parent_id, osha_agency,
       'reporting', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1904.41(a)(1); OAR chapter 437, division 1', 'conditional',
       '20-249 employees at an establishment in an industry listed in Appendix A to Subpart E.',
       'You have between 20 and 249 people at this site and your industry is on OSHA''s list.',
       'Annually by 2 March for the prior calendar year',
       'Submitted 300A summary and the ITA submission confirmation',
       'Submitted late, submitted for the wrong establishment, or not submitted because the industry list was not checked.',
       'high', 'generated', 'ai', current_date),

      ('Electronic submission of Forms 300 and 301 — 100+ employees, Appendix B industry', parent_id, osha_agency,
       'reporting', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1904.41(a)(2); OAR chapter 437, division 1', 'conditional',
       '100 or more employees at an establishment in an industry listed in Appendix B to Subpart E.',
       'You have 100 or more people at this site and your industry is on OSHA''s higher-hazard list.',
       'Annually by 2 March for the prior calendar year',
       'Submitted 300 log and 301 incident reports, and the ITA submission confirmation',
       'Only the 300A was submitted; case-level detail is a separate and larger filing.',
       'high', 'generated', 'ai', current_date),

      ('Electronic submission of Form 300A — 250+ employees', parent_id, osha_agency,
       'reporting', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1904.41(a)(3); OAR chapter 437, division 1', 'conditional',
       '250 or more employees at an establishment required to keep records.',
       'You have 250 or more people at this site.',
       'Annually by 2 March for the prior calendar year',
       'Submitted 300A summary and the ITA submission confirmation',
       'Assumed the industry list applies; at 250+ the size threshold applies regardless.',
       'high', 'generated', 'ai', current_date);
  end if;

  -- ----------------------------------------------------------
  -- SPLIT 2 — Process Safety Management
  --
  -- "PHA every 5 years; audit every 3; refresher <=3; incident investigation within 48
  --  hours; MOC before change" — FIVE clocks — and twelve named evidence types.
  --
  -- 29 CFR 1910.119 has fourteen lettered elements, each separately citable and separately
  -- auditable. A company can be complete on mechanical integrity and have no
  -- management-of-change procedure at all. As one row, that reads "PSM: needs work", which
  -- tells a plant manager nothing about what to do on Monday.
  --
  -- Split into FIVE, grouped by the clock that governs them rather than by the lettered
  -- element, because the clock is what makes them independently failable. Fourteen rows
  -- would be more faithful to the regulation and less useful; five is the grouping the
  -- cadence itself suggests.
  -- ----------------------------------------------------------
  select id into parent_id from public.requirement_templates
   where requirement_name = 'Process Safety Management' and effective_to is null;

  if parent_id is not null then
    update public.requirement_templates set effective_to = current_date where id = parent_id;

    insert into public.requirement_templates
      (requirement_name, split_from_id, agency_id, category, entity_type, source_type,
       jurisdiction_layer, jurisdiction_state, industries, citation, applies,
       trigger_condition, trigger_plain, cadence, evidence_description, fails_if,
       priority, status, generated_by, effective_from)
    values
      ('PSM — process safety information compiled and current', parent_id, osha_agency,
       'written_program', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1910.119(d) as adopted by Oregon OSHA', 'conditional',
       'Process meets Appendix A threshold or has 10,000 lb or more of a covered flammable gas or liquid.',
       'A covered process is above its threshold quantity.',
       'Before operation; updated when the process changes',
       'Chemical hazard data, process technology, and equipment information, dated',
       'Drawings do not match the plant as built.',
       'critical', 'generated', 'ai', current_date),

      ('PSM — process hazard analysis', parent_id, osha_agency,
       'monitoring', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1910.119(e) as adopted by Oregon OSHA', 'conditional',
       'Process meets Appendix A threshold or has 10,000 lb or more of a covered flammable gas or liquid.',
       'A covered process is above its threshold quantity.',
       'Initial PHA, then revalidated at least every 5 years',
       'PHA report, team composition, and resolution of every finding',
       'Findings raised and never closed out.',
       'critical', 'generated', 'ai', current_date),

      ('PSM — mechanical integrity programme', parent_id, osha_agency,
       'monitoring', 'equipment', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1910.119(j) as adopted by Oregon OSHA', 'conditional',
       'Process meets Appendix A threshold or has 10,000 lb or more of a covered flammable gas or liquid.',
       'A covered process is above its threshold quantity.',
       'Inspection and test intervals per recognised engineering practice',
       'Written procedures, inspection and test records, deficiency correction',
       'Equipment run past its inspection interval with no documented basis.',
       'critical', 'generated', 'ai', current_date),

      ('PSM — management of change', parent_id, osha_agency,
       'written_program', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1910.119(l) as adopted by Oregon OSHA', 'conditional',
       'Process meets Appendix A threshold or has 10,000 lb or more of a covered flammable gas or liquid.',
       'A covered process is above its threshold quantity.',
       'Before any change other than a replacement in kind',
       'MOC records showing technical basis, impact, and training before start-up',
       'A change made and the procedure updated afterwards, or not at all.',
       'critical', 'generated', 'ai', current_date),

      ('PSM — compliance audit', parent_id, osha_agency,
       'monitoring', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1910.119(o) as adopted by Oregon OSHA', 'conditional',
       'Process meets Appendix A threshold or has 10,000 lb or more of a covered flammable gas or liquid.',
       'A covered process is above its threshold quantity.',
       'At least every 3 years',
       'Audit report, findings, and documented response to each',
       'Audit performed and findings never responded to in writing.',
       'critical', 'generated', 'ai', current_date);
  end if;

  -- ----------------------------------------------------------
  -- SPLIT 3 — Permit-required confined spaces
  --
  -- "Evaluate initially/after change; permit each entry; training before assignment;
  --  annual canceled-permit review" — four clocks, and the evidence list names an
  --  inventory, a written programme, per-entry permits and a rescue evaluation.
  --
  -- The rescue arrangement is the one that makes this urgent rather than tidy: a site can
  -- have a complete written programme, correct permits, trained entrants — and no rescue
  -- capability. That is the failure mode that kills people in confined spaces, and as one
  -- row it is invisible.
  -- ----------------------------------------------------------
  select id into parent_id from public.requirement_templates
   where requirement_name = 'Permit-required confined spaces' and effective_to is null;

  if parent_id is not null then
    update public.requirement_templates set effective_to = current_date where id = parent_id;

    insert into public.requirement_templates
      (requirement_name, split_from_id, agency_id, category, entity_type, source_type,
       jurisdiction_layer, jurisdiction_state, industries, citation, applies,
       trigger_condition, trigger_plain, cadence, evidence_description, fails_if,
       priority, status, generated_by, effective_from)
    values
      ('Confined spaces — identification and signage', parent_id, osha_agency,
       'physical_control', 'site', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1910.146(c) as adopted by Oregon OSHA', 'conditional',
       'The workplace contains one or more permit-required confined spaces.',
       'You have tanks, vessels, pits or similar spaces people can enter.',
       'Initial evaluation; re-evaluated when the space or its use changes',
       'Written inventory of spaces and danger signage at each',
       'A space added or repurposed and never evaluated.',
       'critical', 'generated', 'ai', current_date),

      ('Confined spaces — written entry programme and permits', parent_id, osha_agency,
       'written_program', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1910.146(d) as adopted by Oregon OSHA', 'conditional',
       'Employees enter a permit-required confined space.',
       'Your people go inside those spaces.',
       'Permit for each entry; annual review of cancelled permits',
       'Written programme, cancelled permits, atmospheric test results per entry',
       'Entries made without a permit, or permits with no atmospheric readings.',
       'critical', 'generated', 'ai', current_date),

      ('Confined spaces — rescue capability', parent_id, osha_agency,
       'certification', 'organization', 'statutory', 'state', 'Oregon', array['chemical-manufacturing'],
       '29 CFR 1910.146(k) as adopted by Oregon OSHA', 'conditional',
       'Employees enter a permit-required confined space.',
       'Your people go inside those spaces.',
       'Evaluated before reliance; drills at least every 12 months',
       'Rescue service evaluation, drill records, retrieval equipment checks',
       'Relying on the fire service without having evaluated its ability to respond in time.',
       'critical', 'generated', 'ai', current_date);
  end if;
end $$;


-- ------------------------------------------------------------
-- 7. VERIFY THE SPLITS
-- ------------------------------------------------------------

do $$
declare orphan_children integer; live_parents integer; total integer;
begin
  select count(*) into orphan_children
    from public.requirement_templates c
    left join public.requirement_templates p on p.id = c.split_from_id
   where c.split_from_id is not null and p.id is null;
  if orphan_children > 0 then
    raise exception 'MIGRATION 013 FAILED: % split child/children point at a parent that does not exist.', orphan_children;
  end if;

  -- A child whose parent is still live means the same obligation is served twice.
  select count(*) into live_parents
    from public.requirement_templates c
    join public.requirement_templates p on p.id = c.split_from_id
   where p.effective_to is null;
  if live_parents > 0 then
    raise exception 'MIGRATION 013 FAILED: % child/children point at a parent that is still LIVE. The customer would see the parent and its children as separate obligations.', live_parents;
  end if;

  select count(*) into total from public.requirement_templates;
  raise notice 'MIGRATION 013 OK: % requirement rows; every split child resolves to a retired parent.', total;
end $$;
