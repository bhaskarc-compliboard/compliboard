-- ============================================================
-- COMPLIBOARD — MIGRATION 014: AN UNIDENTIFIED CHEMICAL MAKES THE ANSWER UNKNOWN
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Migration 013 gave `substance_inventory()` one safety property: a site with NO inventory
-- rows returns NULL, because a site nobody has asked is not a site determined to be below a
-- threshold. That was the right property and it was not enough.
--
-- THE HOLE. `company_chemicals.cas_number` is deliberately nullable — a company can tell us
-- it holds "parts washer solvent" before anybody identifies it, and recording that is more
-- useful than recording nothing. But the function joins on CAS. So a site with ten identified
-- chemicals and one unidentified drum has inventory rows, takes the `else` branch, and the
-- EXISTS returns FALSE — which reads as DETERMINED NOT TO APPLY.
--
-- The same happens with a mistyped CAS: the format CHECK catches `not-a-cas`, but
-- `67-63-1` instead of `67-63-0` is well-formed, matches no row in regulated_substances, and
-- silently drops that substance out of every threshold test.
--
-- *** THAT IS A SILENT WRONG CLEAR, WHICH IS THE ONE FAILURE CLASS THIS PRODUCT EXISTS TO
-- NOT HAVE. *** CLAUDE.md §3.2: absence of evidence never produces a clear. An unidentified
-- drum is absence of evidence.
--
-- FOUND while checking a claim that a compensating control already existed — that every
-- inventory expression sits beneath `hazardous_chemicals_present`, so a wrong CAS would make
-- a requirement unreachable rather than wrongly-cleared. It does not: 0 of the 15 inventory
-- expressions carry that guard. And the guard would not have worked anyway — with
-- `hazardous_chemicals_present = true` and a missed join, the expression still evaluates
-- false. The protection has to be inside the function, where the missing identification is
-- visible.
--
-- WHAT IT DOES
--   Returns NULL when ANY row in the site's inventory is unidentified — no CAS, a CAS that
--   matches no known substance, or a quantity with no unit. The site cannot be said to be
--   below a threshold while part of what it holds is unknown.
-- ============================================================

create or replace function public.substance_inventory(
  p_entity_id uuid,
  p_list      text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    -- Nothing recorded: UNKNOWN. A site nobody asked is not a site below the threshold.
    when not exists (select 1 from public.company_chemicals c where c.entity_id = p_entity_id)
      then null

    -- A POSITIVE ANSWER IS SAFE EVEN WITH GAPS. If a known substance is already over its
    -- own threshold, an unidentified drum elsewhere cannot make that untrue. Checked FIRST
    -- so that an incomplete inventory still yields a definite `true` where one exists —
    -- otherwise every partially-identified site would go unknown and the table would be
    -- useless until perfectly complete.
    when exists (
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
      then true

    -- No positive, AND something in the inventory cannot be evaluated: UNKNOWN, not false.
    -- Three ways a row is unevaluable, and all three are ordinary rather than exotic:
    --   * no CAS at all      — "parts washer solvent", not yet identified
    --   * a CAS we do not hold — mistyped, or a substance not yet in regulated_substances
    --   * a quantity with no unit, or no quantity
    when exists (
      select 1 from public.company_chemicals c
       where c.entity_id = p_entity_id
         and (c.cas_number is null
              or not exists (select 1 from public.regulated_substances r where r.cas_number = c.cas_number)
              or c.max_quantity is null
              or c.unit is null
              or c.unit <> 'lb'::public.chemical_unit))
      then null

    -- Every row identified, quantified in pounds, and none over its threshold: a real FALSE.
    else false
  end
$$;

comment on function public.substance_inventory is
  'Does this SITE hold ANY ONE substance at or above ITS OWN threshold on the named list? '
  'An EXISTS, never a sum. THREE-VALUED: true when a known substance is over its threshold '
  '(safe even if the rest of the inventory is incomplete); NULL when nothing is recorded OR '
  'when any row is unidentified, unquantified, or in a unit we cannot compare; false only '
  'when every row is evaluable and none qualifies. An unidentified drum is absence of '
  'evidence, and absence of evidence never produces a clear — CLAUDE.md §3.2. '
  'Migrations 013 and 014.';


-- ------------------------------------------------------------
-- VERIFY — the three-valued behaviour, by constructing each case
-- ------------------------------------------------------------

do $$
declare co uuid; ent uuid; r boolean;
begin
  select id into co from public.companies limit 1;
  select id into ent from public.entities where company_id = co and is_primary limit 1;
  if co is null or ent is null then
    raise notice 'MIGRATION 014: no company/site on this database; behavioural tests skipped.';
    return;
  end if;

  insert into public.regulated_substances (cas_number, name, is_ehs, ehs_tpq_lb)
  values ('7782-50-5', '__mig014__ chlorine', true, 100);

  -- 1. empty inventory -> NULL
  if public.substance_inventory(ent, 'ehs') is not null then
    raise exception 'MIGRATION 014 FAILED: empty inventory did not return NULL.';
  end if;

  -- 2. one identified row below threshold -> FALSE (a real determination)
  insert into public.company_chemicals (company_id, entity_id, cas_number, substance_name, max_quantity, unit)
  values (co, ent, '7782-50-5', '__mig014__ chlorine', 50, 'lb');
  if public.substance_inventory(ent, 'ehs') is not false then
    raise exception 'MIGRATION 014 FAILED: 50 lb against a 100 lb TPQ should be a definite false.';
  end if;

  -- 3. ADD AN UNIDENTIFIED DRUM -> the answer must become UNKNOWN, not stay false
  insert into public.company_chemicals (company_id, entity_id, cas_number, substance_name, max_quantity, unit)
  values (co, ent, null, '__mig014__ parts washer solvent', 200, 'lb');
  r := public.substance_inventory(ent, 'ehs');
  if r is not null then
    raise exception 'MIGRATION 014 FAILED: an unidentified chemical left the answer as %, not NULL. That is a silent wrong clear.', r;
  end if;

  -- 4. a KNOWN substance over its threshold -> TRUE even though the drum is still unidentified
  update public.company_chemicals set max_quantity = 250
   where entity_id = ent and cas_number = '7782-50-5';
  if public.substance_inventory(ent, 'ehs') is not true then
    raise exception 'MIGRATION 014 FAILED: a definite positive was lost because another row was unidentified. An incomplete inventory must still answer true where it can.';
  end if;

  -- 5. a well-formed CAS that matches nothing -> UNKNOWN
  update public.company_chemicals set max_quantity = 50
   where entity_id = ent and cas_number = '7782-50-5';
  delete from public.company_chemicals where entity_id = ent and cas_number is null;
  insert into public.company_chemicals (company_id, entity_id, cas_number, substance_name, max_quantity, unit)
  values (co, ent, null, '__mig014__ unknown solvent', 10, 'lb');
  if public.substance_inventory(ent, 'ehs') is not null then
    raise exception 'MIGRATION 014 FAILED: an unmatched substance did not produce NULL.';
  end if;

  delete from public.company_chemicals where substance_name like '__mig014__%';
  delete from public.regulated_substances where cas_number = '7782-50-5';

  if exists (select 1 from public.company_chemicals where substance_name like '__mig014__%')
     or exists (select 1 from public.regulated_substances where name like '__mig014__%') then
    raise exception 'MIGRATION 014 FAILED: test rows survived.';
  end if;

  raise notice 'MIGRATION 014 OK: empty -> NULL, below -> false, unidentified -> NULL, known positive survives an incomplete inventory.';
end $$;
