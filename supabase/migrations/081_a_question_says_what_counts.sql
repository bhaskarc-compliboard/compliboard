-- =================================================================================================
-- 081 — A QUESTION SAYS WHAT COUNTS.
-- =================================================================================================
--
-- WHY.
--
-- The Dashboard asks a person three switch questions a day (Dashboard step 7, decision 8). Board 2
-- draws a grey line under each question saying what counts and what does not — "Anyone on payroll,
-- full or part time. Owners who only draw a share do not count." Step 7 could not draw it, because
-- there is nothing to draw it from: `switches` carries `question_plain`, `label` and `notes`, and
-- `notes` is OUR working note, not the customer's. On this database it reads
--
--     has_employees → "NOT IN §2.4 AND NEEDED BY 9 REQUIREMENTS — payroll tax, I-9, workers' comp,
--                      USERRA, safety committee … Oregon's safety-committee rule exempts a sole
--                      owner who is the only employee."
--
-- Putting that on a customer's Dashboard is the raw-industry-slug mistake the Dashboard's step 5
-- removed. Writing the sentence inside a React component instead would be a page inventing
-- regulatory guidance, which `CLAUDE.md` §3.3 and §6 both forbid. So the sentence belongs in the
-- library, beside the question it explains, and both pages read it from there.
--
-- *** AND THE HELP LINE IS NOT DECORATION. *** `has_employees` "looks trivially true and is not":
-- Oregon's safety-committee rule exempts a sole owner who is the only employee, so an owner-only
-- business that answers Yes gets a safety committee it does not owe. One sentence is the whole
-- difference between a right and a wrong answer, and nine requirements hang off that switch.
--
-- THE SECOND HALF: SOME QUESTIONS CANNOT BE ANSWERED YES OR NO.
--
-- The Dashboard card draws a `boolean` switch as two buttons, Yes and No. Ten of the eighteen
-- company-scope yes/no questions were not written for two buttons — they offer alternatives, and a
-- person pressing Yes cannot say which half they mean:
--
--     owns_fleet → "Do you run your own trucks, or does a carrier collect everything?"
--
-- Yes to which? The question is rewritten as a plain yes/no question and the other half moves to
-- the help line, where it belongs: "If a carrier collects everything, answer No." Nothing about
-- what the switch MEANS changes — the value written is the same `true`/`false`, gating the same
-- requirements. What changes is whether a person can give it honestly.
--
-- WHAT THIS MIGRATION DOES NOT DO.
--
--   · It does not touch `allowed_values`. Every one of the twelve option values on the three enum
--     switches is compared against by at least one live requirement's `applies_expression` (read
--     from the catalog, 20 October: `toll_processor` 2, `manufacturer` 2, `both` 4, `imports` 2,
--     `iso_9001` 1, and so on). They are KEYS. Renaming one would silently change which
--     requirements apply to a company, which is the §3.2 class of failure this product exists to
--     avoid. They read as machine words on a button — `toll_processor` — because they have no
--     display labels, so section 1b gives them labels instead and leaves every key alone.
--   · It does not fill `help_plain` for site-scope switches. They are not asked on the Dashboard
--     (decision 8), and three of them share `owns_fleet`'s exact shape — a question whose Yes is
--     ambiguous. They are named in the step's report and deliberately left alone:
--       air_toxics_program_applicable · exposure_vinyl_chloride · industrial_stormwater
--
-- `DECISIONS.md` and `docs/DASHBOARD-PLAN.md` decision 8.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. THE COLUMN
-- -------------------------------------------------------------------------------------------------
--
-- Nullable, and it stays nullable: 73 site-scope switches have no help line today and a NOT NULL
-- would mean inventing 73 sentences to satisfy a constraint. The card draws the line when it is
-- there and nothing when it is not, which is the honest behaviour either way.
--
-- No GRANT line is needed and none is written: `switches` is reference data that every
-- authenticated caller already reads (`switches_select`), and a column inherits the table's SELECT.
-- Adding one would be the "a grant list describes what you added" mistake pointing the other way.

alter table public.switches
  add column if not exists help_plain text;

comment on column public.switches.help_plain is
  'One short sentence a customer reads UNDER the question, in plain words: what counts, and what '
  'does not. Written for a small business owner, not for us — never a citation, never a section '
  'number, never a working note. `notes` is the working note and is never shown to anybody. Null '
  'is allowed and means the question is shown on its own.';

-- -------------------------------------------------------------------------------------------------
-- 1b. THE LABELS FOR OPTION VALUES
-- -------------------------------------------------------------------------------------------------
--
-- *** THE VALUE IS A KEY AND THE LABEL IS A WORD, AND THEY ARE NOT THE SAME THING. ***
--
-- A `toll_processor` button is machine text on a customer's Dashboard. The obvious fix — rename
-- the value to "Toll processor" — is the dangerous one: every one of these twelve strings is
-- compared against by at least one live requirement's `applies_expression`, so renaming one
-- changes which requirements apply to a company and nothing fails loudly while it happens.
--
-- So the value stays and a label sits beside it. `app/company-information/page.tsx` has been
-- waiting for this since September: "The switch library carries `allowed_values` and no labels for
-- them, so there is nothing to render an enum through … When labels exist in the library, this is
-- the one place that changes."

alter table public.switches
  add column if not exists allowed_value_labels jsonb;

comment on column public.switches.allowed_value_labels is
  'value → the word a button shows, for an enum switch. The KEYS of this map are the strings in '
  '`allowed_values`, which live requirement `applies_expression`s compare against and which must '
  'never be renamed to make them readable — that would silently change which requirements apply. '
  'This is the readable half. Null for a switch with no options.';

update public.switches set allowed_value_labels = jsonb_build_object(
  'manufacturer',   'Manufacturer',
  'blender',        'Blender',
  'repackager',     'Repackager',
  'distributor',    'Distributor',
  'toll_processor', 'Toll processor')
where id = 'business_type';

update public.switches set allowed_value_labels = jsonb_build_object(
  'none',       'Neither',
  'iso_9001',   'ISO 9001',
  'iso_14001',  'ISO 14001',
  'both',       'Both')
where id = 'holds_iso_certification';

update public.switches set allowed_value_labels = jsonb_build_object(
  'neither',  'Neither',
  'imports',  'Imports',
  'exports',  'Exports',
  'both',     'Both')
where id = 'imports_exports';

-- -------------------------------------------------------------------------------------------------
-- 2. THE EIGHTEEN YES/NO QUESTIONS
-- -------------------------------------------------------------------------------------------------
--
-- Ten of them are reworded. Each `update` that changes `question_plain` carries the old wording in
-- a comment above it, so the before and after are in the file rather than only in a report.

-- Unchanged. The one the board wrote the example sentence for, and the one that most needs it.
update public.switches set
  help_plain = 'Anyone on payroll, full or part time. Owners who only draw a share do not count.'
where id = 'has_employees';

-- before: Do you run your own trucks, or does a carrier collect everything?
update public.switches set
  question_plain = 'Do you run your own trucks?',
  help_plain     = 'If a carrier collects everything, answer No.'
where id = 'owns_fleet';

-- before: Do you own, lease, load, or unload DOT cargo tanks?
--
-- The list moves into the help line. "Rail tank cars do not" is READ, not assumed. The switch is
-- named `cargo_tanks_or_rail`, so the question is whether the requirements behind it reach rail.
-- Both of them, read from the library on 20 October:
--
--   Cargo tank inspection/test              49 CFR § 180.407
--     trigger: "Owns/leases/uses DOT cargo tank."
--   Cargo-tank loading/unloading controls   49 CFR §§ 177.834, 177.837
--     trigger: "Loads/unloads hazmat from motor vehicle/cargo tank."
--
-- Part 180 subpart E is cargo tanks and Part 177 is carriage by public highway; a rail tank car is
-- neither, and no live requirement in the library covers one (200 live rows, zero). So the switch's
-- name promises something the library does not deliver, and a person with rail tank cars and no
-- cargo tanks who answered Yes would be handed two highway requirements they do not owe. The help
-- line says so.
update public.switches set
  question_plain = 'Do you work with DOT cargo tanks?',
  help_plain     = 'Owning, leasing, loading or unloading one all count. Rail tank cars do not.'
where id = 'cargo_tanks_or_rail';

-- before: Do you package any hazardous product for household or consumer use?
update public.switches set
  question_plain = 'Do you package any hazardous product for consumers?',
  help_plain     = 'Anything sold for use at home. Products sold only to other businesses do not count.'
where id = 'consumer_products_cpsc';

-- before: Do you hold federal contracts or subcontracts?
update public.switches set
  question_plain = 'Do you hold any federal contract?',
  help_plain     = 'A subcontract under someone else''s federal prime contract counts too.'
where id = 'federal_contractor';

-- before: Do any customers or trade bodies impose audit or compliance requirements on you?
update public.switches set
  question_plain = 'Do any customers require you to meet their own compliance rules?',
  help_plain     = 'Trade-body schemes you have signed up to count too, like Responsible Distribution.'
where id = 'has_contract_flowdowns';

-- before: Do you have hourly or otherwise non-exempt staff?
-- "Non-exempt" is a term of art a small business owner does not use. The question asks the thing
-- they do know — is anyone paid by the hour — and the help line catches the salaried half.
update public.switches set
  question_plain = 'Do you have any hourly staff?',
  help_plain     = 'Also anyone on a salary who is still owed overtime.'
where id = 'nonexempt_employees';

-- before: Has anyone alleged a significant adverse health or environmental reaction to one of your
--         products that you have not recorded?
update public.switches set
  question_plain = 'Has anyone claimed one of your products caused harm?',
  help_plain     = 'Harm to health or the environment, claimed by anyone, that you have not written down.'
where id = 'open_adverse_reaction_allegation';

-- before: Did you manufacture or import PFAS, or articles containing PFAS, at any time between
--         2011 and 2022?
update public.switches set
  question_plain = 'Did you manufacture PFAS at any time between 2011 and 2022?',
  help_plain     = 'Importing counts too, including PFAS inside articles you brought in.'
where id = 'pfas_2011_2022';

-- before: Do you sponsor a retirement or welfare benefit plan?
-- "Welfare benefit plan" is ERISA's term, not a person's. The question keeps both halves because
-- both gate requirements — ERISA plan documents and Form 5500 — and the help line names the kinds.
update public.switches set
  question_plain = 'Do you sponsor a retirement or benefit plan for employees?',
  help_plain     = 'A 401(k), health, life or disability plan you sponsor all count.'
where id = 'sponsors_erisa_plan';

-- before: Do you handle methylene chloride, perchloroethylene, trichloroethylene, or another
--         substance under a TSCA risk-management rule?
-- The three substances stay in the QUESTION, under their shop names, because they are what a
-- person recognises; the rule they fall under moves to the help line. "EPA adds more each year" is
-- there because the switch is marked annual for exactly that reason.
update public.switches set
  question_plain = 'Do you handle methylene chloride, perc or TCE?',
  help_plain     = 'Or any other substance EPA has put under a TSCA risk-management rule. EPA adds more each year.'
where id = 'tsca_regulated_substances';

-- The remaining seven yes/no questions already read as yes/no questions and keep their wording.
update public.switches set
  help_plain = 'Your own drivers only. A carrier''s drivers are their employees, not yours.'
where id = 'cdl_drivers';

update public.switches set
  help_plain = 'Medical cover you offer employees, whether you pay for it or they do.'
where id = 'has_group_health_plan';

update public.switches set
  help_plain = 'Any second place you work from — a plant, a warehouse, a yard.'
where id = 'multi_site';

update public.switches set
  help_plain = 'Count a state where you have people or premises, not one you only sell into.'
where id = 'multi_state';

-- before: Have you obtained information reasonably supporting a conclusion of substantial risk
--         that EPA does not already have?
-- The owner's call at the step 7b stop. It was answerable with Yes or No and still unreadable:
-- "information reasonably supporting a conclusion of substantial risk" is the statute's phrase,
-- and the switch's own note says the trigger is genuinely a judgement — the switch records that a
-- person has decided, it does not decide. A person can only make that judgement about a question
-- they understand.
update public.switches set
  question_plain = 'Have you learned something that suggests one of your chemicals is seriously risky?',
  help_plain     = 'Something that EPA has not already been told.'
where id = 'open_substantial_risk_information';

update public.switches set
  help_plain = 'If a carrier needs shipping papers or placards for it, the answer is Yes.'
where id = 'ships_placardable_hazmat';

update public.switches set
  help_plain = 'Any written promise not to work for a competitor after leaving.'
where id = 'uses_noncompete_agreements';

-- -------------------------------------------------------------------------------------------------
-- 3. THE THREE OPTION QUESTIONS
-- -------------------------------------------------------------------------------------------------
--
-- Their wording is unchanged: each question already reads as a question its options answer. The
-- OPTIONS themselves are another matter and are not touched here — see the header.

update public.switches set
  help_plain = 'Pick what you mainly do with chemicals. Toll processing is making to someone else''s recipe.'
where id = 'business_type';

update public.switches set
  help_plain = 'Only certificates from a registrar count, not that you follow the standard.'
where id = 'holds_iso_certification';

update public.switches set
  help_plain = 'Counts whether you move them yourself or a freight forwarder does it for you.'
where id = 'imports_exports';

-- -------------------------------------------------------------------------------------------------
-- 4. THE ONE NUMBER
-- -------------------------------------------------------------------------------------------------
--
-- A number and not bands, deliberately: three of the seven thresholds the library names fall
-- inside the bands that were once proposed, so a banded answer cannot resolve them at all.

update public.switches set
  help_plain = 'Everyone on payroll across all your sites, full or part time.'
where id = 'employee_count';

-- -------------------------------------------------------------------------------------------------
-- 5. THE SELF-TEST
-- -------------------------------------------------------------------------------------------------
--
-- It fails loudly and the whole migration rolls back, because a half-applied library is worse than
-- an unapplied one: a card would draw a help line under some questions and not others and nobody
-- would know which were missing.

do $$
declare
  n_company   int;
  n_helped    int;
  bad         text;
  n_long      int;
begin
  -- 5a. THE CHECK CAN SEE A PRESENCE. A count of zero here would make every check below pass
  --     against nothing at all, which is `CLAUDE.md` §9a's trap exactly.
  select count(*) into n_company
    from public.switches where scope = 'company' and question_plain is not null;
  if n_company < 20 then
    raise exception '081 5a: expected at least 20 company-scope questions, found %', n_company;
  end if;

  -- 5b. EVERY ONE OF THEM HAS A HELP LINE, and it is not an empty string pretending to be one.
  select count(*) into n_helped
    from public.switches
   where scope = 'company' and question_plain is not null
     and help_plain is not null and btrim(help_plain) <> '';
  if n_helped <> n_company then
    select string_agg(id, ', ' order by id) into bad
      from public.switches
     where scope = 'company' and question_plain is not null
       and (help_plain is null or btrim(help_plain) = '');
    raise exception '081 5b: % of % company-scope questions have no help line: %',
      n_company - n_helped, n_company, bad;
  end if;

  -- 5c. SHORT ENOUGH TO READ UNDER A QUESTION. 120 is the ceiling, not the target; the longest
  --     written here is 90.
  select count(*), string_agg(id, ', ' order by id) into n_long, bad
    from public.switches where help_plain is not null and length(help_plain) >= 120;
  if n_long > 0 then
    raise exception '081 5c: % help line(s) at or over 120 characters: %', n_long, bad;
  end if;

  -- 5d. NOT OUR WORDING. A citation, a section number, a fragment of a working note or a link has
  --     got into a sentence a customer reads. Case-sensitive on the acronyms on purpose: a blind
  --     lower-case match on 'ors' would fire on "sponsors".
  select string_agg(id, ', ' order by id) into bad
    from public.switches
   where help_plain is not null
     and (help_plain like '%§%'
       or help_plain like '%CFR%'
       or help_plain like '%ORS%'
       or help_plain like '%NOT IN%'
       or help_plain like '%http://%'
       or help_plain like '%https://%'
       or help_plain like '%www.%');
  if bad is not null then
    raise exception '081 5d: help line(s) carrying a citation, a note or a link: %', bad;
  end if;

  -- 5e. EVERY YES/NO QUESTION CAN BE ANSWERED YES OR NO.
  --
  --     *** THE RULE IS A CLAUSE JOINER, NOT THE WORD "or" — and the first run of this migration
  --     is why. *** It began as `like '% or %'`, which refused the migration on
  --     `sponsors_erisa_plan` and `tsca_regulated_substances`. Both were right and the check was
  --     wrong: "a retirement or benefit plan" and "methylene chloride, perc or TCE" are LISTS, and
  --     Yes to a list is unambiguous. The defect being hunted is an ALTERNATIVE —
  --
  --         "Do you run your own trucks, or does a carrier collect everything?"
  --
  --     — where Yes cannot say which half is meant. That shape joins two clauses, and three
  --     joiners cover it: ", or ", " or is ", " or does ".
  --
  --     Company scope only: the 44 site-scope questions carrying " or " are not asked on the
  --     Dashboard and are not this migration's to rewrite. Three of them have the real defect and
  --     are recorded as owed in `docs/HANDOFF-CODE.md` §7.
  select string_agg(id, ', ' order by id) into bad
    from public.switches
   where scope = 'company' and value_type = 'boolean' and question_plain is not null
     and (question_plain like '%, or %'
       or question_plain like '% or is %'
       or question_plain like '% or does %');
  if bad is not null then
    raise exception '081 5e: yes/no question(s) offering alternatives: %', bad;
  end if;

  -- 5e-proof. THE RULE, RUN AGAINST THE TEN WORDINGS THIS MIGRATION REPLACED, so that what it
  --     catches is recorded rather than asserted. It fires on FOUR of them. The other six were
  --     reworded for plainness, not for ambiguity — "Do you hold federal contracts or
  --     subcontracts?" is answerable with Yes, it was simply longer than it needed to be — and a
  --     rule that caught them would have to catch "a retirement or benefit plan" too, because the
  --     wording it replaced ("a retirement or welfare benefit plan") is the same shape. That is
  --     not a gap in the rule; it is the difference between a defect and a preference.
  if not (
       'Do you run your own trucks, or does a carrier collect everything?'       like '%, or %'
   and 'Do you own, lease, load, or unload DOT cargo tanks?'                     like '%, or %'
   and 'Did you manufacture or import PFAS, or articles containing PFAS, at any time between 2011 and 2022?' like '%, or %'
   and 'Do you handle methylene chloride, perchloroethylene, trichloroethylene, or another substance under a TSCA risk-management rule?' like '%, or %'
  ) then
    raise exception '081 5e-proof: the rule no longer catches a wording it was written for';
  end if;
  -- And it must NOT fire on the two the first run refused.
  if 'Do you sponsor a retirement or benefit plan for employees?' like '%, or %'
  or 'Do you sponsor a retirement or benefit plan for employees?' like '% or is %'
  or 'Do you sponsor a retirement or benefit plan for employees?' like '% or does %'
  or 'Do you handle methylene chloride, perc or TCE?' like '%, or %'
  or 'Do you handle methylene chloride, perc or TCE?' like '% or is %'
  or 'Do you handle methylene chloride, perc or TCE?' like '% or does %' then
    raise exception '081 5e-proof: the rule refuses a list again';
  end if;

  -- 5f. AND NOTHING ELSE MOVED. The option values are keys that live requirement expressions
  --     compare against; this migration must not have touched one.
  if not exists (select 1 from public.switches
                  where id = 'business_type'
                    and allowed_values @> array['manufacturer','blender','repackager','distributor','toll_processor']::text[]) then
    raise exception '081 5f: business_type allowed_values changed';
  end if;
  if not exists (select 1 from public.switches
                  where id = 'imports_exports'
                    and allowed_values @> array['neither','imports','exports','both']::text[]) then
    raise exception '081 5f: imports_exports allowed_values changed';
  end if;
  if not exists (select 1 from public.switches
                  where id = 'holds_iso_certification'
                    and allowed_values @> array['none','iso_9001','iso_14001','both']::text[]) then
    raise exception '081 5f: holds_iso_certification allowed_values changed';
  end if;

  -- 5h. EVERY OPTION HAS A WORD. A value with no label draws as itself — `toll_processor` on a
  --     button — which is the thing 1b exists to stop, and it would do it silently.
  select string_agg(id || ':' || v, ', ' order by id, v) into bad
    from public.switches s, unnest(s.allowed_values) as v
   where s.id in ('business_type', 'holds_iso_certification', 'imports_exports')
     and (s.allowed_value_labels is null
       or s.allowed_value_labels -> v is null
       or btrim(s.allowed_value_labels ->> v) = '');
  if bad is not null then
    raise exception '081 5h: option value(s) with no label: %', bad;
  end if;

  -- And no label map names a value the switch does not have, which would be a label nothing can
  -- ever draw — the other half of the same mistake.
  select string_agg(s.id || ':' || k, ', ' order by s.id, k) into bad
    from public.switches s, jsonb_object_keys(s.allowed_value_labels) as k
   where s.allowed_value_labels is not null and not (k = any (s.allowed_values));
  if bad is not null then
    raise exception '081 5h: label(s) for a value the switch does not allow: %', bad;
  end if;

  -- 5g. The site-scope switches are untouched: none has gained a help line.
  if exists (select 1 from public.switches where scope = 'site' and help_plain is not null) then
    raise exception '081 5g: a site-scope switch has a help line; this migration writes none';
  end if;

  raise notice '081: % company-scope questions, all with a help line, none over 120 characters; '
    'every option value on the three enum switches has a label.', n_company;
end $$;
