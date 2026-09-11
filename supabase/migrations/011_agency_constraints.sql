-- ============================================================
-- COMPLIBOARD — MIGRATION 011: THE CONSTRAINTS THAT MAKE THE AGENCY TABLES HONEST
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Phase 2.1 is about to put rows into `agencies` and `industry_coverage` for the first
-- time. Both tables were created empty by migration 007 and 008, before anything was known
-- about the shape of a row, so both were left permissive: almost every column nullable, no
-- uniqueness beyond the surrogate primary key, and no rule tying a status to the evidence
-- behind it.
--
-- Permissive was right while the tables were empty and wrong the moment they are not. Each
-- of the four changes below closes a failure that is SILENT — the database accepts the row,
-- the query returns without error, and the product is simply wrong somewhere a person has
-- to notice by hand.
--
--   1. UNIQUE on agencies. A second "Oregon OSHA" row is accepted today. Because
--      `industry_coverage` is keyed on (industry, jurisdiction_state, agency_id), a
--      duplicate agency splits one regulator's coverage into two half-rows that each look
--      complete and each pass every constraint. That is CHEMICAL-OR-WA.md §1.1's
--      "makes omissions detectable" failing quietly, which is the one job the coverage
--      table exists to do.
--
--   2. jurisdiction_level NOT NULL on agencies. The Stage 2 agency-scoping query (§5.2)
--      selects on `jurisdiction_level = 'federal' or (… = 'state' and jurisdiction_state =
--      …)`. A row with a NULL level matches NO branch of that. It is not an error, it is an
--      absence: the agency is invisible to the pipeline, and the only symptom is a
--      regulator quietly missing from an answer.
--
--   3. CHECK on industry_coverage. This table renders the coverage strip (CLAUDE.md §6),
--      which is a promise made directly to the customer: "OSHA ✓verified · DEQ ✓verified ·
--      Local fire ◐partial". Today `status = 'verified'` with `verified_by = null` is a
--      legal row, and it displays as ✓verified. That is the omniscient status tracker with
--      a NULL where the person should be.
--
--   4. GIN index on agencies.industries. `industries && ARRAY[…]` is the access pattern —
--      it is how §7 "verticals are data, not code" is actually implemented, and how the
--      cannabis and chemical verticals share Oregon OSHA, DEQ, ODA, DOR and local fire
--      without duplicating the row. `requirement_templates` has this index; `agencies` was
--      given the same column and not the index.
--
-- WHAT IT DELIBERATELY DOES NOT DO
--
--   `industry_coverage.row_count` is left exactly as it is — see section 6, which records
--   the finding rather than acting on it.
--
-- SAFETY
--
--   Both tables are EMPTY in staging and in production, verified by SELECT count(*) on 11
--   September: agencies 0, industry_coverage 0, in both. So every NOT NULL and every CHECK
--   below applies to zero existing rows and cannot fail on data. No table is created here,
--   so no REVOKE is needed (CLAUDE.md §3.6 — default privileges only bite on CREATE TABLE).
-- ============================================================


-- ------------------------------------------------------------
-- 1. short_name becomes a key, so it has to behave like one
--
-- The unique constraint below is on `short_name` rather than `name`, because `name` is
-- prose written for a human — "Oregon Occupational Safety and Health Division" — and prose
-- drifts. `short_name` is "OR-OSHA" and does not.
--
-- A key that may be NULL is not a key. The constraint would still function with NULLs (see
-- section 3 — it is NULLS NOT DISTINCT, so two NULL short_names at the same jurisdiction
-- WOULD collide), but a row with no short_name has nothing stable to cite it by, and
-- Stage 2's prompt has nothing short to print. Empty table, so this costs nothing now and
-- cannot be added later without a backfill.
--
-- *** This one goes beyond the four changes asked for. Say the word and it comes out —
--     the unique constraint works without it. ***
-- ------------------------------------------------------------

alter table public.agencies
  alter column short_name set not null;


-- ------------------------------------------------------------
-- 2. jurisdiction_level NOT NULL
-- ------------------------------------------------------------

alter table public.agencies
  alter column jurisdiction_level set not null;


-- ------------------------------------------------------------
-- 3. UNIQUE (short_name, jurisdiction_level, jurisdiction_state)
--
-- *** NULLS NOT DISTINCT IS THE WHOLE POINT OF THIS CONSTRAINT, NOT A DETAIL. ***
--
-- Every federal agency row has `jurisdiction_state = NULL` — EPA, DOT/PHMSA, FMCSA, federal
-- OSHA. Under PLAIN `unique`, two NULLs are never equal to each other, so a plain UNIQUE on
-- these three columns would permit TWO "EPA / federal / NULL" rows and refuse nothing at
-- all for the entire federal layer. The constraint would look present and protect the half
-- of the table that needs it least.
--
-- `nulls not distinct` (PG15+; this database is 17.6) makes NULL equal to NULL for the
-- purposes of this constraint, which is what "there is only one EPA" means. Same reasoning
-- as `industry_coverage_unique` in migration 008, and it is tested by violation in
-- section 7, twice — once with a state and once without.
--
-- Clause order note, because I got this wrong in 007 and the migration was rejected: in a
-- TABLE CONSTRAINT, `nulls not distinct` goes after `unique` and before the column list. In
-- `create unique index` it goes AFTER the column list. They are not the same grammar.
-- ------------------------------------------------------------

alter table public.agencies
  add constraint agencies_short_name_jurisdiction_key
  unique nulls not distinct (short_name, jurisdiction_level, jurisdiction_state);


-- ------------------------------------------------------------
-- 4. The jurisdiction columns must match the level that names them
--
-- The same silent failure as a NULL level, one layer down. A row with
-- `jurisdiction_level = 'state'` and `jurisdiction_state = NULL` matches no company in the
-- Stage 2 query either — it is a state agency of no state.
--
-- The rule, by level:
--   federal  — jurisdiction_state must be NULL. A federal agency belongs to no state, and
--              a state written here would make the row match one state and miss the other 49.
--   state    — jurisdiction_state required.
--   county   — jurisdiction_state AND jurisdiction_county required.
--   city     — jurisdiction_state AND jurisdiction_city required.
--   local    — jurisdiction_state required, and NOTHING MORE. This is deliberate: "local
--              fire authority" is a real row with no city, because which fire district
--              covers an address is not derivable from the address (DECISIONS.md §25 — it
--              is the one jurisdiction fact geocoding does not answer, and the product asks
--              the user). Forcing a city here would force us to invent one.
--
-- This mirrors `requirement_templates_named_jurisdiction` from migration 007, plus the
-- federal rule that table does not carry.
--
-- *** This is the second addition beyond the four asked for. It is the same class of bug as
--     change 2 and I would keep it, but it is separable — dropping this one constraint
--     leaves the other four intact. ***
-- ------------------------------------------------------------

alter table public.agencies
  add constraint agencies_named_jurisdiction check (
    case jurisdiction_level
      when 'federal' then jurisdiction_state is null
      when 'state'   then jurisdiction_state is not null
      when 'county'  then jurisdiction_state is not null and jurisdiction_county is not null
      when 'city'    then jurisdiction_state is not null and jurisdiction_city   is not null
      when 'local'   then jurisdiction_state is not null
      else false   -- see note below
    end
  );

-- The `else false` is not defensive padding. jurisdiction_layer has five values today; a
-- sixth added by a later `alter type … add value` would fall through a CASE with no ELSE
-- and return NULL — and a CHECK passes on NULL (CLAUDE.md §3.7). So the constraint would
-- silently stop applying to exactly the newest, least-tested kind of row. `else false`
-- makes that a loud refusal instead: whoever adds a jurisdiction layer has to come here and
-- say what its jurisdiction columns mean.


-- ------------------------------------------------------------
-- 5. GIN index on industries
--
-- Named to the convention in CLAUDE.md §3.7 and matching
-- idx_requirement_templates_industries, which is the same column, the same type and the
-- same query.
-- ------------------------------------------------------------

create index if not exists idx_agencies_industries
  on public.agencies using gin (industries);


-- ------------------------------------------------------------
-- 6. industry_coverage: 'verified' requires a person and a date
--
-- `status` already had one guard from migration 008 — `verified_has_rows`, which stops a
-- non-'not_built' row from claiming coverage over zero requirements. This is its pair, and
-- it guards the other half of the same sentence: not "is there anything behind this", but
-- "did a human look at it".
--
-- CLAUDE.md §4 and §6: the worker never publishes regulatory content; only a human sets
-- verified. That rule lived only in prose, and prose does not stop an INSERT.
--
-- Written so that NULL is allowed everywhere except where it is a lie: a 'generated' or
-- 'not_built' row may leave verified_by and last_verified_at NULL, which is the honest
-- state for a row nobody has reviewed.
-- ------------------------------------------------------------

alter table public.industry_coverage
  add constraint industry_coverage_verified_has_a_verifier check (
    status <> 'verified'
    or (verified_by is not null and last_verified_at is not null)
  );


-- ------------------------------------------------------------
-- 6b. row_count — THE FINDING, RECORDED AND NOT ACTED ON
--
-- `row_count` is a plain integer with a default of 0. Nothing computes it, nothing
-- recomputes it when the library changes, and no constraint relates it to
-- requirement_templates. It is a number somebody types.
--
-- That makes it a CLAIM ABOUT THE LIBRARY THAT THE LIBRARY DOES NOT HAVE TO HONOUR. Worse,
-- the existing `verified_has_rows` CHECK reads `row_count > 0` — so a typed number is also
-- the thing that lets a 'verified' row exist over zero actual requirements, which is
-- exactly what that CHECK was written to prevent. A constraint that can be satisfied by
-- typing is not a constraint.
--
-- It should be DERIVED: the count of live requirement_templates rows matching this
-- (industry, jurisdiction_state, agency_id), recomputed whenever the library changes. That
-- is a trigger or a generated view, it is a decision about where derived data lives, and it
-- is not this migration's business. Recorded here so it is chosen rather than inherited.
--
-- UNTIL THEN: NOTHING MAY WRITE row_count BY HAND. The Phase 2.1 loader computes it from
-- the library, or it leaves it at 0 and the row stays 'not_built'.
-- ------------------------------------------------------------

comment on column public.industry_coverage.row_count is
  'How many live requirement_templates rows stand behind this coverage claim. DERIVED, '
  'NEVER TYPED — nothing recomputes it today, so a hand-written value is a claim the '
  'library does not have to honour, and the verified_has_rows CHECK can then be satisfied '
  'by typing rather than by having requirements. Migration 011 section 6b. Compute it from '
  'requirement_templates or leave it at 0.';

comment on constraint agencies_short_name_jurisdiction_key on public.agencies is
  'There is only one EPA. NULLS NOT DISTINCT because every federal row has a NULL state, '
  'and a plain UNIQUE would treat those NULLs as distinct and police nothing across the '
  'whole federal layer. A duplicate agency splits its industry_coverage into two half-rows '
  'that both look complete — CHEMICAL-OR-WA.md §1.1.';


-- ------------------------------------------------------------
-- 7. VERIFY — BY VIOLATION
--
-- CLAUDE.md §3.7: "Test a CHECK by violating it; a constraint nobody has tried to break is
-- a comment." Migration 008 shipped a CHECK that accepted everything because
-- array_length() returns NULL on an empty array, and it was caught only by attempting the
-- write it was supposed to refuse.
--
-- Every block below attempts a write that MUST fail. Each `begin … exception … end` is a
-- subtransaction, so a caught failure rolls its test rows back and leaves nothing behind.
-- If a write that should fail SUCCEEDS, the block raises on purpose, nothing catches it,
-- and the whole migration aborts — so a constraint that does not bite cannot ship.
--
-- One block runs the other way round: a correctly-filled row that MUST be accepted, so that
-- a constraint which refuses everything is caught too. A CHECK of `false` would pass every
-- negative test in this file.
--
-- Marker short_name '__MIG011__' so anything left behind by a partial failure is greppable.
-- ------------------------------------------------------------

do $$
declare
  a_id uuid;
begin
  ---------------------------------------------------------------
  -- 7.1  duplicate agency, WITH a state  → must be refused
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test Agency One', '__MIG011__', 'test', 'state', 'Testland');
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test Agency One, renamed', '__MIG011__', 'test', 'state', 'Testland');
    raise exception
      'MIGRATION 011 FAILED: two agencies with the same short_name, level and state were both accepted. The unique constraint is not biting.';
  exception
    when unique_violation then null;   -- expected
  end;

  ---------------------------------------------------------------
  -- 7.2  duplicate agency, NO state (the federal case)  → must be refused
  --      This is the test that a plain UNIQUE would fail.
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test Federal Agency', '__MIG011__', 'test', 'federal', null);
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test Federal Agency, again', '__MIG011__', 'test', 'federal', null);
    raise exception
      'MIGRATION 011 FAILED: two federal agencies with the same short_name and a NULL state were both accepted. NULLS NOT DISTINCT is missing — the constraint polices nothing across the federal layer.';
  exception
    when unique_violation then null;   -- expected
  end;

  ---------------------------------------------------------------
  -- 7.3  NULL jurisdiction_level  → must be refused
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test No Level', '__MIG011__', 'test', null, 'Testland');
    raise exception
      'MIGRATION 011 FAILED: an agency with no jurisdiction_level was accepted. It would be invisible to the Stage 2 query.';
  exception
    when not_null_violation then null; -- expected
  end;

  ---------------------------------------------------------------
  -- 7.4  NULL short_name  → must be refused
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test No Short Name', null, 'test', 'state', 'Testland');
    raise exception
      'MIGRATION 011 FAILED: an agency with no short_name was accepted. short_name is the key.';
  exception
    when not_null_violation then null; -- expected
  end;

  ---------------------------------------------------------------
  -- 7.5  state level, no state  → must be refused
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test State Agency Of Nowhere', '__MIG011__', 'test', 'state', null);
    raise exception
      'MIGRATION 011 FAILED: a state-level agency with no state was accepted. It matches no company.';
  exception
    when check_violation then null;    -- expected
  end;

  ---------------------------------------------------------------
  -- 7.6  federal level, WITH a state  → must be refused
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test Federal Agency Of Oregon', '__MIG011__', 'test', 'federal', 'Oregon');
    raise exception
      'MIGRATION 011 FAILED: a federal agency pinned to one state was accepted. It would match that state and miss every other.';
  exception
    when check_violation then null;    -- expected
  end;

  ---------------------------------------------------------------
  -- 7.7  county level, no county  → must be refused
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state, jurisdiction_county)
    values ('Test County Agency', '__MIG011__', 'test', 'county', 'Testland', null);
    raise exception
      'MIGRATION 011 FAILED: a county-level agency with no county was accepted.';
  exception
    when check_violation then null;    -- expected
  end;

  ---------------------------------------------------------------
  -- 7.8  coverage claimed verified with no person  → must be refused
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test Agency For Coverage', '__MIG011__', 'test', 'state', 'Testland')
    returning id into a_id;

    insert into public.industry_coverage (industry, jurisdiction_state, agency_id, status, row_count, verified_by, last_verified_at)
    values ('test-industry', 'Testland', a_id, 'verified', 1, null, now());
    raise exception
      'MIGRATION 011 FAILED: a coverage row was marked verified with no verified_by. The coverage strip would show a customer a tick nobody put there.';
  exception
    when check_violation then null;    -- expected
  end;

  ---------------------------------------------------------------
  -- 7.9  coverage claimed verified with no date  → must be refused
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state)
    values ('Test Agency For Coverage', '__MIG011__', 'test', 'state', 'Testland')
    returning id into a_id;

    insert into public.industry_coverage (industry, jurisdiction_state, agency_id, status, row_count, verified_by, last_verified_at)
    values ('test-industry', 'Testland', a_id, 'verified', 1, 'a person', null);
    raise exception
      'MIGRATION 011 FAILED: a coverage row was marked verified with no last_verified_at. "Verified" with no date is not verified.';
  exception
    when check_violation then null;    -- expected
  end;

  ---------------------------------------------------------------
  -- 7.10 THE POSITIVE CONTROL — a correctly-filled pair MUST be accepted.
  --      Without this, a constraint that refuses everything passes 7.1–7.9.
  --      Rows are deleted at the end of the block; if anything here fails, the
  --      handler rolls the block back and aborts the migration with a plain message.
  ---------------------------------------------------------------
  begin
    insert into public.agencies (name, short_name, agency_type, jurisdiction_level, jurisdiction_state, industries)
    values ('Test Agency, Well Formed', '__MIG011__', 'test', 'state', 'Testland', array['test-industry'])
    returning id into a_id;

    insert into public.industry_coverage (industry, jurisdiction_state, agency_id, status, row_count, verified_by, last_verified_at)
    values ('test-industry', 'Testland', a_id, 'verified', 1, 'a person', now());

    -- and a 'not_built' row with no person and no date is legal, because that is the
    -- honest state of a regulator nobody has covered yet — the row the coverage table
    -- exists to show.
    insert into public.industry_coverage (industry, jurisdiction_state, agency_id, status, row_count)
    values ('test-industry-2', 'Testland', a_id, 'not_built', 0);

    delete from public.industry_coverage where agency_id = a_id;
    delete from public.agencies where id = a_id;
  exception
    when others then
      raise exception
        'MIGRATION 011 FAILED: a correctly-filled agency and coverage pair was REFUSED, so one of the new constraints is too strict. Postgres said: %', sqlerrm;
  end;

  ---------------------------------------------------------------
  -- 7.11 the GIN index actually exists
  ---------------------------------------------------------------
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'agencies' and indexname = 'idx_agencies_industries'
  ) then
    raise exception 'MIGRATION 011 FAILED: idx_agencies_industries was not created.';
  end if;

  ---------------------------------------------------------------
  -- 7.12 nothing survived the tests
  ---------------------------------------------------------------
  if exists (select 1 from public.agencies where short_name = '__MIG011__') then
    raise exception 'MIGRATION 011 FAILED: test rows survived. Delete where short_name = ''__MIG011__''.';
  end if;

  raise notice 'MIGRATION 011 OK: 9 illegal writes refused, 1 legal write accepted, GIN index present, no test rows left behind.';
end $$;
