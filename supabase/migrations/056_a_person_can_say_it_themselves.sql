-- 056 — A FACT A PERSON TYPED IS NEITHER READ NOR INFERRED
--
-- Task 0, commit 2. `company_facts.basis` has been `read | inferred` since migration 050, and both
-- values describe **how a MODEL came by a claim**: `read` means the words are in the document,
-- `inferred` means the model concluded it. That was the whole vocabulary a fact needed while the
-- only way into the table was confirming a reading.
--
-- The "Your company" page adds a second way in: a person editing a confirmed line, typing the right
-- answer over a wrong one. Under the old CHECK that edit has to claim one of two things that are
-- both false — that the words are in a document, or that a model worked them out. `read` is the one
-- it would default to, and it is the worse of the two: the line would then read as quoted from a
-- file nobody wrote it in.
--
-- So: `declared`. Same word `company_switches.source` already uses for the same event
-- (`user_set` there, and `evidence_class = 'declared'` on `switch_determinations` since migration
-- 026, whose own comment says "the other four classes describe how a DOCUMENT supports a claim; a
-- person is not on that scale"). This is that distinction, one table across.
--
-- ---------------------------------------------------------------------------
-- WHY A MIGRATION AND NOT A WORKAROUND
--
-- `source_document_id IS NULL` plus `confirmed_by` already implies "a person put this here", so the
-- fact is *derivable* without a new basis value. It is still the wrong shape, for the reason §52 and
-- §50 both record: a meaning that has to be reconstructed from the absence of two other columns is a
-- meaning the next reader gets wrong. `basis` is the column that answers "how do we know this", and
-- the honest answer for an edit is a third value, not a silence.
--
-- ADDITIVE AND BACKWARD-COMPATIBLE. Nothing is required to write `declared`; every existing row
-- stays `read` or `inferred`, and the two readers of the column — `lib/companyContext.ts` and
-- `prompts/document-scan.ts`, which each render "(inferred)" and nothing for anything else — treat a
-- third value as "not inferred", which is correct.
--
-- `fact_proposals.basis` is deliberately NOT widened. A proposal is always a model's reading of a
-- document; a person does not propose to themselves. Leaving that CHECK at two values is what keeps
-- the two tables saying different things on purpose.
-- ===========================================================================

begin;

alter table public.company_facts drop constraint company_facts_basis_check;
alter table public.company_facts add constraint company_facts_basis_check
  check (basis = any (array['read', 'inferred', 'declared']));

comment on column public.company_facts.basis is
  'How we know this. read = the words are in the source document. inferred = a model concluded it '
  'from the document. declared = a person typed it on the Your company page, in which case '
  'source_document_id is null and confirmed_by is who typed it.';

-- ===========================================================================
-- VERIFY. The constraint is tested by trying to break it (§3.7) — a CHECK nobody has tried to break
-- is a comment — and the privileges are READ BACK. Probe rows hang off a THROWAWAY company.
-- ===========================================================================
do $$
declare
  co uuid; site_a uuid; n int;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 056 probe', 'chemical-manufacturing', 'OR') returning id into co;
  select id into site_a from public.entities where company_id = co and is_primary;

  -- ---- the new value is accepted, company-wide and per site ----
  insert into public.company_facts (company_id, key, value, basis, source_document_id)
       values (co, 'shift_pattern', '"two shifts"'::jsonb, 'declared', null);
  insert into public.company_facts (company_id, key, value, basis, entity_id, source_document_id)
       values (co, 'shift_pattern', '"three shifts"'::jsonb, 'declared', site_a, null);
  select count(*) into n from public.company_facts where company_id = co and basis = 'declared';
  if n <> 2 then
    raise exception 'MIGRATION 056 FAILED: declared was not accepted on both scopes (% rows).', n;
  end if;

  -- ---- the two old values still are; this is additive ----
  insert into public.company_facts (company_id, key, value, basis)
       values (co, 'facility_address', '"4410 NW Front Ave"'::jsonb, 'read');
  insert into public.company_facts (company_id, key, value, basis)
       values (co, 'fda_registered', 'true'::jsonb, 'inferred');
  select count(*) into n from public.company_facts where company_id = co;
  if n <> 4 then
    raise exception 'MIGRATION 056 FAILED: read or inferred stopped being accepted (% rows).', n;
  end if;

  -- ---- and a fourth value is still refused, so the column is still a closed set ----
  begin
    update public.company_facts set basis = 'guessed' where company_id = co and key = 'fda_registered';
    raise exception 'MIGRATION 056 FAILED: basis accepted "guessed" — the set is no longer closed.';
  exception when check_violation then null; end;

  -- ---- fact_proposals.basis is UNCHANGED, and that is the point ----
  -- A person does not propose a fact to themselves. If this ever accepts `declared`, the two tables
  -- have stopped saying different things and the distinction this migration exists for is gone.
  declare
    doc uuid;
  begin
    insert into public.documents (company_id, name, file_url, file_type)
         values (co, 'migration-056-probe.pdf', 'probe/056', 'application/pdf') returning id into doc;
    begin
      insert into public.fact_proposals (company_id, document_id, source, switch_key, proposed_value, basis)
           values (co, doc, 'document', 'shift_pattern', 'two shifts', 'declared');
      raise exception 'MIGRATION 056 FAILED: fact_proposals.basis accepted "declared"; it must not.';
    exception when check_violation then null; end;
  end;

  -- ---- privileges, READ BACK. Changing a CHECK must not have moved a grant. ----
  if has_table_privilege('anon', 'public.company_facts', 'SELECT')
     or has_table_privilege('anon', 'public.company_facts', 'INSERT') then
    raise exception 'MIGRATION 056 FAILED: anon holds a privilege on company_facts.';
  end if;
  if not has_table_privilege('authenticated', 'public.company_facts', 'SELECT') then
    raise exception 'MIGRATION 056 FAILED: authenticated cannot read company_facts.';
  end if;
  if has_table_privilege('authenticated', 'public.company_facts', 'INSERT')
     or has_table_privilege('authenticated', 'public.company_facts', 'UPDATE') then
    raise exception 'MIGRATION 056 FAILED: authenticated can write company_facts directly; an edit '
                    'goes through /api/your-company on the service role after ownership is proved.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 056 OK: basis accepts declared on both scopes, read and inferred still work, a fourth value is refused, and fact_proposals.basis is untouched.';
end $$;

commit;
