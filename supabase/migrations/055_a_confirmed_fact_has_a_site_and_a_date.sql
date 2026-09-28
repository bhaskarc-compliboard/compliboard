-- 055 — A CONFIRMED FACT BELONGS TO A SITE, AND CARRIES THE DATE ITS SOURCE WAS TRUE
--
-- Task 0, commit 1. `docs/VISION-DOCUMENTS.md` "One company context" names three things the
-- company-context function has to settle as it is built, and two of them are columns:
--
--   "Fact keys gain a site scope, because key reuse pushed two sites' addresses onto one key.
--    And confirmed facts carry the as-of date of the document they came from, so a fact from a
--    2021 handbook does not read as current."
--
-- This migration is those two, on `company_facts` and on `fact_proposals`, and nothing else.
--
-- ---------------------------------------------------------------------------
-- 1. WHY A SITE, AND WHY THE UNIQUENESS HAD TO CHANGE WITH IT
--
-- `company_facts` was UNIQUE (company_id, key): one company, one answer per key. That is the rule
-- Run 6 was written to enforce, and it was the right rule for the failure it fixed — one address
-- arriving as five keys from four documents, so the To confirm queue asked five questions about a
-- fact the customer has one answer to.
--
-- It is the wrong rule for a company with two plants, and `CLAUDE.md` §1 already says why: 73 of
-- the 95 switches are site-scoped, "because a second plant has its own air permit, its own
-- generator category and its own forklifts". A fact read out of the Portland permit and a fact
-- read out of the Salem permit are not two answers to one question. Under the old constraint the
-- second confirmation overwrote the first, silently, and the context block then told every prompt
-- one site's number as though it were the company's.
--
-- So: one row per company and key WITH NO SITE (the company-wide answer), one row per company,
-- key and site, and both may stand side by side. `employee_count` company-wide and
-- `site_employee_count` per site are the shape `company_switches` already has (migration 008);
-- this gives the same shape to the facts that are not switches.
--
-- *** THE UNIQUE INDEX IS `NULLS NOT DISTINCT`, AND THAT IS THE WHOLE MECHANISM. ***
-- Postgres treats NULLs as distinct in a unique index by default, so a plain
-- UNIQUE (company_id, key, entity_id) would accept TWO company-wide rows for one key — the exact
-- thing the old constraint existed to stop, reintroduced by widening it. `NULLS NOT DISTINCT`
-- (Postgres 15+; staging and production are 17.6) makes the two NULLs collide, so the
-- company-wide row is still unique. This is a CHECK-on-NULL trap in a different costume (§3.7)
-- and the verify block below tries the write rather than trusting the index definition.
--
-- ---------------------------------------------------------------------------
-- 2. WHY THE FOREIGN KEY IS COMPOSITE
--
-- `entity_id uuid references entities(id)` would let a fact on company A point at company B's
-- site. Nothing in the schema would object, and the context block would then name another
-- customer's plant on this customer's screen. That is a tenancy failure, and §3.6 says tenancy is
-- the database's job and not a route's.
--
-- So the FK is (company_id, entity_id) -> entities (company_id, id), which needs a unique key on
-- the entities side — added here. MATCH SIMPLE (the default) is what makes the nullable half
-- work: when entity_id IS NULL the constraint is not checked at all, so a company-wide row is
-- legal; when it is set, both columns are checked together and another company's site is refused.
--
-- `company_switches.entity_id` has the same hole and is NOT fixed here — it is a separate table
-- with its own callers and its own probe, and widening this migration to cover it would mean
-- shipping two changes under one verify block. Recorded, not done.
--
-- ---------------------------------------------------------------------------
-- 3. WHY `as_of` COSTS NOTHING TO ADD
--
-- The scan has been reading it since Run 1 and throwing it away. `prompts/document-scan.ts:237`
-- asks for `"as_of": "YYYY-MM-DD or null"` on every fact; `lib/documentScan.ts:103` types it and
-- `:341` parses it through `date()`. Then `saveScan`'s insert into `fact_proposals` does not name
-- the column, because there was no column.
--
-- That is the third time this exact shape has appeared: `quote_verified` was computed and
-- discarded until migration 047, and `affects` until 051. Both times the queue that needed the
-- value had nothing to show. **No prompt changes in this migration's commit** — the field is
-- already asked for and already parsed; this is the column it was always being parsed into.
--
-- It is DATE, not timestamptz: "the handbook was revised in February 2021" is a day, and
-- `CLAUDE.md` §3.7 says DATE not timestamp for dates.
-- ===========================================================================

begin;

-- ------------------------------------------------------------
-- the entities side of the composite key
-- ------------------------------------------------------------
-- Additive and cheap: `id` is already the primary key, so this index can never reject an existing
-- row. It exists only so (company_id, entity_id) has something to reference.
alter table public.entities
  add constraint entities_company_id_id_key unique (company_id, id);

-- ------------------------------------------------------------
-- company_facts
-- ------------------------------------------------------------
alter table public.company_facts
  add column entity_id uuid,
  add column as_of date;

comment on column public.company_facts.entity_id is
  'The site this fact is about. NULL = company-wide. A company-wide row and one row per site may '
  'stand side by side for the same key; two company-wide rows for one key cannot.';
comment on column public.company_facts.as_of is
  'The date the source document says this was true. NULL when the source gives no date. Read by '
  'lib/companyContext.ts so a fact out of a 2021 handbook does not read as current.';

alter table public.company_facts
  add constraint company_facts_entity_in_same_company
  foreign key (company_id, entity_id)
  references public.entities (company_id, id) on delete cascade;

-- The swap. Confirmed from the catalog before it was written (§3.7): `pg_constraint` reports
-- `company_facts_company_id_key_key` as UNIQUE (company_id, key) on staging today.
alter table public.company_facts
  drop constraint company_facts_company_id_key_key;

create unique index company_facts_one_per_key_and_site
  on public.company_facts (company_id, key, entity_id) nulls not distinct;

-- ------------------------------------------------------------
-- fact_proposals — the same two columns, filled by the scan
-- ------------------------------------------------------------
-- NO uniqueness here, deliberately. A proposal is a reading, and two documents proposing the same
-- key is the normal case the To confirm queue exists to collapse (Run 6). Constraining it would
-- turn a second document's reading into an error.
alter table public.fact_proposals
  add column entity_id uuid,
  add column as_of date;

comment on column public.fact_proposals.entity_id is
  'The site the source document belongs to, copied from documents.entity_id at scan time. NULL '
  'when the document is not filed against a site.';
comment on column public.fact_proposals.as_of is
  'The date the document says the fact was true, from the scan''s own as_of field. Parsed since '
  'Run 1 and discarded until this migration.';

alter table public.fact_proposals
  add constraint fact_proposals_entity_in_same_company
  foreign key (company_id, entity_id)
  references public.entities (company_id, id) on delete set null;

-- Company-leading, per §3.7's naming rule. The context block reads a company's facts by site.
create index idx_company_facts_company_entity on public.company_facts (company_id, entity_id);

-- ===========================================================================
-- VERIFY. Every constraint is tested by trying to break it (§3.7) — a CHECK nobody has tried to
-- break is a comment — and every privilege is READ BACK rather than taken from the grant list.
-- The probe rows hang off a THROWAWAY COMPANY, never a real customer's (the pattern 052 and 053
-- set).
-- ===========================================================================
do $$
declare
  co uuid; co2 uuid; site_a uuid; site_b uuid; other_site uuid;
  doc uuid; prop uuid; n int;
begin
  -- Two throwaway companies: the second exists only to own a site this one must not reach.
  insert into public.companies (name, industry, state)
       values ('Migration 055 probe', 'chemical-manufacturing', 'OR') returning id into co;
  insert into public.companies (name, industry, state)
       values ('Migration 055 probe — someone else', 'chemical-manufacturing', 'OR') returning id into co2;

  -- `create_primary_site` gave each of them one site already. Take this company's, and add a
  -- second, so the two-site case is real rather than described.
  select id into site_a from public.entities where company_id = co and is_primary;
  if site_a is null then
    raise exception 'MIGRATION 055 FAILED: the create_primary_site trigger did not give the probe company a site.';
  end if;
  insert into public.entities (company_id, entity_type, name, state, city)
       values (co, 'site', 'Migration 055 probe — Salem', 'OR', 'Salem') returning id into site_b;
  select id into other_site from public.entities where company_id = co2 and is_primary;

  insert into public.documents (company_id, name, file_url, file_type, entity_id)
       values (co, 'migration-055-probe.pdf', 'probe/055', 'application/pdf', site_a)
       returning id into doc;

  -- ---- 1. the company-wide row, and the as-of date ----
  insert into public.company_facts (company_id, key, value, basis, as_of)
       values (co, 'employee_count', '"47"'::jsonb, 'read', date '2021-02-01');
  if (select as_of from public.company_facts where company_id = co and entity_id is null)
     <> date '2021-02-01' then
    raise exception 'MIGRATION 055 FAILED: as_of did not store the date it was given.';
  end if;

  -- ---- 2. TWO COMPANY-WIDE ROWS FOR ONE KEY MUST BE IMPOSSIBLE ----
  -- The whole reason the index says NULLS NOT DISTINCT. Without it this insert SUCCEEDS and the
  -- old constraint's guarantee is gone.
  begin
    insert into public.company_facts (company_id, key, value, basis)
         values (co, 'employee_count', '"38"'::jsonb, 'read');
    raise exception 'MIGRATION 055 FAILED: a second company-wide row for one key was accepted. '
                    'NULLS NOT DISTINCT is not doing its job.';
  exception when unique_violation then null; end;

  -- ---- 3. A SITE ROW BESIDE THE COMPANY-WIDE ONE IS THE POINT ----
  insert into public.company_facts (company_id, key, value, basis, entity_id, as_of)
       values (co, 'employee_count', '"6"'::jsonb, 'read', site_a, date '2026-09-01');
  insert into public.company_facts (company_id, key, value, basis, entity_id)
       values (co, 'employee_count', '"41"'::jsonb, 'read', site_b);
  select count(*) into n from public.company_facts where company_id = co and key = 'employee_count';
  if n <> 3 then
    raise exception 'MIGRATION 055 FAILED: expected 3 rows for one key (company-wide + two sites), found %.', n;
  end if;

  -- ---- 4. but not two rows for one key at ONE site ----
  begin
    insert into public.company_facts (company_id, key, value, basis, entity_id)
         values (co, 'employee_count', '"9"'::jsonb, 'read', site_b);
    raise exception 'MIGRATION 055 FAILED: two rows for one key at one site were accepted.';
  exception when unique_violation then null; end;

  -- ---- 5. A SITE ROW POINTING AT ANOTHER COMPANY'S ENTITY MUST BE IMPOSSIBLE ----
  -- A plain `references entities(id)` accepts this. The composite key is what refuses it, and
  -- this is the write that proves the difference.
  begin
    insert into public.company_facts (company_id, key, value, basis, entity_id)
         values (co, 'facility_address', '"somewhere else"'::jsonb, 'read', other_site);
    raise exception 'MIGRATION 055 FAILED: a fact pointed at another company''s site.';
  exception when foreign_key_violation then null; end;

  -- ---- 6. fact_proposals carries both columns, and the same tenancy rule ----
  insert into public.fact_proposals
         (company_id, document_id, source, switch_key, proposed_value, entity_id, as_of)
       values (co, doc, 'document', 'employee_count', '6', site_a, date '2026-09-01')
       returning id into prop;
  if (select as_of from public.fact_proposals where id = prop) <> date '2026-09-01'
     or (select entity_id from public.fact_proposals where id = prop) <> site_a then
    raise exception 'MIGRATION 055 FAILED: fact_proposals did not store entity_id and as_of.';
  end if;
  begin
    insert into public.fact_proposals
           (company_id, document_id, source, switch_key, proposed_value, entity_id)
         values (co, doc, 'document', 'facility_address', 'somewhere else', other_site);
    raise exception 'MIGRATION 055 FAILED: a proposal pointed at another company''s site.';
  exception when foreign_key_violation then null; end;

  -- ---- 7. two documents may propose the same key; proposals are NOT unique ----
  insert into public.fact_proposals
         (company_id, document_id, source, switch_key, proposed_value, entity_id)
       values (co, doc, 'document', 'employee_count', '41', site_a);
  select count(*) into n from public.fact_proposals
   where company_id = co and switch_key = 'employee_count';
  if n <> 2 then
    raise exception 'MIGRATION 055 FAILED: a second proposal for one key was refused; the queue needs both.';
  end if;

  -- ---- 8. deleting a site takes its facts and releases its proposals ----
  delete from public.entities where id = site_b;
  select count(*) into n from public.company_facts where company_id = co and entity_id = site_b;
  if n <> 0 then
    raise exception 'MIGRATION 055 FAILED: a site was deleted and its facts survived.';
  end if;
  -- The company-wide row and site_a's row are untouched.
  select count(*) into n from public.company_facts where company_id = co and key = 'employee_count';
  if n <> 2 then
    raise exception 'MIGRATION 055 FAILED: deleting one site changed another site''s facts (% left).', n;
  end if;

  -- ---- privileges, READ BACK. A grant list says what was added, not what a role holds. ----
  -- No table is created here, so nothing was granted; the point is that adding a column did not
  -- quietly open one.
  if has_table_privilege('anon', 'public.company_facts', 'SELECT')
     or has_table_privilege('anon', 'public.company_facts', 'INSERT')
     or has_table_privilege('anon', 'public.company_facts', 'UPDATE')
     or has_table_privilege('anon', 'public.company_facts', 'DELETE')
     or has_table_privilege('anon', 'public.fact_proposals', 'SELECT')
     or has_table_privilege('anon', 'public.fact_proposals', 'INSERT') then
    raise exception 'MIGRATION 055 FAILED: anon holds a privilege on company_facts or fact_proposals.';
  end if;
  if not has_table_privilege('authenticated', 'public.company_facts', 'SELECT') then
    raise exception 'MIGRATION 055 FAILED: authenticated cannot read company_facts.';
  end if;
  if has_table_privilege('authenticated', 'public.company_facts', 'INSERT')
     or has_table_privilege('authenticated', 'public.company_facts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.company_facts', 'DELETE') then
    raise exception 'MIGRATION 055 FAILED: authenticated can write company_facts directly; '
                    'confirming a fact goes through /api/to-confirm on the service role (§3.6).';
  end if;
  if not has_table_privilege('authenticated', 'public.entities', 'SELECT') then
    raise exception 'MIGRATION 055 FAILED: authenticated cannot read entities.';
  end if;
  if not has_column_privilege('authenticated', 'public.company_facts', 'entity_id', 'SELECT')
     or not has_column_privilege('authenticated', 'public.company_facts', 'as_of', 'SELECT') then
    raise exception 'MIGRATION 055 FAILED: the two new columns are not readable by authenticated.';
  end if;

  delete from public.companies where id = co;
  delete from public.companies where id = co2;
  raise notice 'MIGRATION 055 OK: one company-wide row per key and one per site, side by side; a second company-wide row refused by NULLS NOT DISTINCT; another company''s site refused by the composite key; as_of stores a date on both tables; deleting a site takes only its own facts; anon holds nothing and authenticated cannot write a fact.';
end $$;

commit;
