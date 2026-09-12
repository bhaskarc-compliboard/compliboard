-- ============================================================
-- COMPLIBOARD — MIGRATION 012: NUMERIC SWITCHES CARRY THEIR THRESHOLDS
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Phase 6.2 is about to seed `switches` for the first time. Reading the 188 trigger
-- conditions in `requirement_templates` produced a fact the schema cannot currently hold:
-- a numeric switch's value is meaningless without the numbers it is measured against.
--
-- `employee_count = 47` is not a fact the product can reason about. 47 is under 50 and over
-- 25; it is three away from the FMLA threshold and twenty-two past OFLA's. The trigger prose
-- names seven distinct employee thresholds — 6, 10, 15, 20, 25, 50 and 100 — and without
-- them stored beside the switch, nothing downstream can know that 47 IS NEAR ANYTHING.
--
-- Concretely, it blocks three things:
--
--   1. The determination gate cannot ask a proximity question. docs/DETERMINATION-GATE.md
--      §11 specifies confirming a value that is present but fragile — "I have 47 employees
--      on file, is that still right? FMLA applies at 50." Deciding whether 47 is near
--      anything requires the 50.
--   2. `applies_expression` (6.3) has to hard-code every threshold into every expression,
--      so the number 15 would appear in the ADA row, the Title VII row and the PWFA row —
--      three places to get it wrong, and nowhere to look it up.
--   3. Nothing can answer "which requirements does this company sit near the edge of",
--      which is the most useful question a compliance product can answer and is not
--      askable today at all.
--
-- WHY NOW RATHER THAN LATER. `switches` has 0 rows in both environments, so this is a
-- column addition against nothing. Once 6.3 writes `applies_expression` referencing these
-- rows, and once company_switches holds values pinned to them, the same change means a
-- backfill and a re-derivation. It is free today and awkward in two weeks.
--
-- WHAT IT DOES
--   1. switches.thresholds numeric[] — nullable, meaningful only for value_type = 'number'
--   2. A CHECK: a non-numeric switch may not carry thresholds
--   3. A CHECK: thresholds, where present, are sorted ascending and distinct
-- ============================================================


-- ------------------------------------------------------------
-- 1. THE COLUMN
--
-- `numeric`, not integer: employee counts are whole numbers but kilograms per month,
-- gallons and tonnes of CO2e are not, and one array type has to hold all of them.
-- CLAUDE.md §3.7 — NUMERIC never float, because 1320.0 as a float is not reliably 1320.
--
-- NULLABLE rather than defaulting to '{}'. A NULL means "this switch has no thresholds",
-- which is the honest state for every boolean and enum switch. An empty array would say
-- "this numeric switch has no thresholds", which is a different and much rarer claim.
-- ------------------------------------------------------------

alter table public.switches
  add column thresholds numeric[];

comment on column public.switches.thresholds is
  'The numbers this switch is measured against, ascending. READ FROM THE REQUIREMENT '
  'TRIGGER PROSE, NEVER ASSUMED — employee_count carries [6,10,15,20,25,50,100] because '
  'those are the seven thresholds the library actually names. Meaningful only when '
  'value_type = ''number''. Without it a stored value of 47 cannot be known to be near '
  'anything, which is what the gate''s proximity confirmation needs (DETERMINATION-GATE.md '
  '§11) and what applies_expression would otherwise hard-code once per requirement.';


-- ------------------------------------------------------------
-- 2. A NON-NUMERIC SWITCH MAY NOT CARRY THRESHOLDS
--
-- A boolean switch with thresholds is a modelling error that reads as harmless: nothing
-- would break, and nobody would notice the numbers were never consulted. Refusing it keeps
-- the column's meaning single.
-- ------------------------------------------------------------

alter table public.switches
  add constraint switches_thresholds_only_on_numeric check (
    thresholds is null or value_type = 'number'
  );


-- ------------------------------------------------------------
-- 3. THRESHOLDS ARE SORTED AND DISTINCT
--
-- Everything downstream reads this array positionally — "the next threshold up from 47" is
-- a scan that assumes order. An unsorted array gives a wrong neighbour rather than an
-- error, which is the failure class this project keeps finding: accepted, silent, wrong.
--
-- *** A CHECK CONSTRAINT MAY NOT CONTAIN A SUBQUERY. ***
-- The first version of this migration expressed the rule with `not exists (select 1 from
-- unnest(thresholds) with ordinality ...)`, and its own comment claimed that form "stays a
-- CHECK". Postgres refused the whole file: `cannot use subquery in check constraint
-- (SQLSTATE 0A000)`. It rolled back cleanly — the column was not added and the migration
-- table stayed on 011 — which is the transaction-per-file behaviour working, and the same
-- clean refusal migration 007 got for a misplaced NULLS NOT DISTINCT.
--
-- A CHECK may call a FUNCTION, and the function may contain the query. It must be IMMUTABLE
-- for the planner to accept it in a constraint.
--
-- `cardinality`, not `array_length`: array_length('{}', 1) is NULL and a NULL inside a CHECK
-- passes, which shipped once already in migration 008 (CLAUDE.md §3.7).
-- ------------------------------------------------------------

create or replace function public.array_is_ascending(a numeric[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  -- true when every element is strictly greater than the one before it. An empty or
  -- one-element array produces no comparisons, bool_and returns NULL, and `is not false`
  -- makes that true — which is correct: nothing is out of order.
  select bool_and(a[i] < a[i + 1]) is not false
    from generate_subscripts(a, 1) as i
   where i < cardinality(a)
$$;

comment on function public.array_is_ascending is
  'Strictly ascending test for a numeric array. Exists because a CHECK constraint may not '
  'contain a subquery and this rule needs one — see migration 012 section 3. IMMUTABLE so '
  'the planner accepts it inside a constraint.';

alter table public.switches
  add constraint switches_thresholds_sorted_and_distinct check (
    thresholds is null
    or cardinality(thresholds) = 0
    or public.array_is_ascending(thresholds)
  );


-- ------------------------------------------------------------
-- 4. VERIFY — BY VIOLATION
--
-- CLAUDE.md §3.7: test a CHECK by violating it. Every block below attempts a write that
-- MUST fail; each `begin … exception … end` is a subtransaction, so a caught failure rolls
-- its test row back. If a write that should fail SUCCEEDS, the block raises and the whole
-- migration aborts.
-- ------------------------------------------------------------

do $$
begin
  -- 4.1 a boolean switch carrying thresholds → refused
  begin
    insert into public.switches (id, label, scope, value_type, determination_source, thresholds)
    values ('__mig012_bool__', 'test', 'company', 'boolean', 'profile', array[10]::numeric[]);
    raise exception
      'MIGRATION 012 FAILED: a boolean switch was allowed to carry thresholds. The numbers would never be consulted and nobody would notice.';
  exception when check_violation then null;
  end;

  -- 4.2 an unsorted threshold array → refused
  begin
    insert into public.switches (id, label, scope, value_type, determination_source, thresholds)
    values ('__mig012_unsorted__', 'test', 'company', 'number', 'profile', array[50, 10, 100]::numeric[]);
    raise exception
      'MIGRATION 012 FAILED: an unsorted thresholds array was accepted. Everything downstream reads this positionally, so an unsorted array returns the wrong neighbour rather than an error.';
  exception when check_violation then null;
  end;

  -- 4.3 duplicate thresholds → refused
  begin
    insert into public.switches (id, label, scope, value_type, determination_source, thresholds)
    values ('__mig012_dupes__', 'test', 'company', 'number', 'profile', array[10, 10, 50]::numeric[]);
    raise exception
      'MIGRATION 012 FAILED: duplicate thresholds were accepted.';
  exception when check_violation then null;
  end;

  -- 4.4 THE POSITIVE CONTROL — a correctly-formed numeric switch MUST be accepted, and a
  --     boolean switch with NULL thresholds must be too. Without this, a CHECK of `false`
  --     passes every test above.
  begin
    insert into public.switches (id, label, scope, value_type, determination_source, thresholds)
    values ('__mig012_ok_num__', 'test', 'company', 'number', 'profile',
            array[6, 10, 15, 20, 25, 50, 100]::numeric[]);
    insert into public.switches (id, label, scope, value_type, determination_source, thresholds)
    values ('__mig012_ok_bool__', 'test', 'company', 'boolean', 'profile', null);
    delete from public.switches where id like '__mig012%';
  exception when others then
    raise exception
      'MIGRATION 012 FAILED: a correctly-formed switch was REFUSED, so one of the new constraints is too strict. Postgres said: %', sqlerrm;
  end;

  -- 4.5 nothing survived
  if exists (select 1 from public.switches where id like '__mig012%') then
    raise exception 'MIGRATION 012 FAILED: test rows survived. Delete where id like ''__mig012%%''.';
  end if;

  raise notice 'MIGRATION 012 OK: thresholds added; 3 illegal writes refused, 2 legal writes accepted, no test rows left behind.';
end $$;
