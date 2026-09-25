-- 041 — WHETHER THE MODEL READ IT OR WORKED IT OUT.
--
-- WHY. `prompts/document-scan.ts` has always asked for it — "Anything you worked out rather than
-- read is marked as inferred" — and there has been nowhere to put the answer. The contract went
-- `{key, value, quote, locator, as_of, affects}` for a fact and carried no such field, so the
-- instruction produced, at best, the word "inferred" somewhere inside a sentence, and Documents
-- Run 2 had to check for it by searching the free text of every item. That is not a check; it is
-- a guess about prose.
--
-- It matters because three of the six golden answer keys turn on it, and all three turn on it for
-- the same reason. Spec 05, the supplier's SDS: "the only acceptable facts are marked inferred …
-- A fact stated as read, such as 'the company uses sodium hydroxide', fails the run" — because
-- the SDS does not say the company uses it. Spec 03: "Acceptable inferred fact: the company has
-- employees who handle marijuana items (only if marked inferred)". Spec 04: "the plant is
-- FDA-registered (inferred; must be marked inferred)".
--
-- And it matters beyond the tests. A fact goes to `fact_proposals` for a person to confirm, and
-- "we read this in your permit" and "we think this follows from your permit" are two different
-- questions to put to somebody. The queue cannot ask the right one without knowing which it is.
--
-- The same is true of a gap: "section 4 is missing" is read off the document, "you will need a
-- validation study" is worked out, and a person triaging a report deserves to see which.
--
-- DEFAULT 'read', NOT 'inferred'. Every row that exists today was written before the field did,
-- so no row's basis is known. The default has to be the one that is safe to be wrong about, and
-- it is not this one: calling an inference "read" overstates it. But `read` is also what the
-- overwhelming majority of existing rows are — they carry a verbatim quote and a locator — and a
-- NOT NULL column has to default to something. So: default 'read', and the honest statement is
-- that rows written before this migration were not asked the question. New rows are.
--
-- NOT AN ENUM, deliberately, against `CLAUDE.md` §3.7's preference. The rule's reasoning is that
-- `ALTER TYPE ... ADD VALUE` beats drop-and-recreate for a column whose value set will grow. This
-- one will not grow: a thing is either in the document or it is not, and a third value would mean
-- the distinction had stopped being the one worth drawing. A two-value CHECK reads at the point
-- of use and costs nothing to test by violating it, which is what the block at the bottom does.

begin;

alter table public.document_gaps
  add column if not exists basis text not null default 'read';

alter table public.fact_proposals
  add column if not exists basis text not null default 'read';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'document_gaps_basis_check') then
    alter table public.document_gaps
      add constraint document_gaps_basis_check check (basis in ('read', 'inferred'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fact_proposals_basis_check') then
    alter table public.fact_proposals
      add constraint fact_proposals_basis_check check (basis in ('read', 'inferred'));
  end if;
end $$;

comment on column public.document_gaps.basis is
  'read = the words are in the document; inferred = the model worked it out. Rows written before '
  'migration 041 were never asked and carry the default, read.';
comment on column public.fact_proposals.basis is
  'read = the words are in the document; inferred = the model worked it out. A proposal is put to '
  'a person differently depending on which. Rows written before migration 041 carry the default.';

-- ---------------------------------------------------------------------------
-- VERIFY, BY TRYING TO BREAK IT.
--
-- §3.7: a CHECK nobody has tried to violate is a comment. Each probe below attempts the write the
-- constraint is supposed to refuse, with a PLAUSIBLE wrong value rather than obvious rubbish —
-- 'unknown' and 'assumed' are exactly what somebody would reach for next.
-- ---------------------------------------------------------------------------
do $$
declare
  co uuid; doc uuid; sc uuid;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 041: no company on this database, constraint probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-041-probe.pdf', 'probe/041', 'application/pdf', 1, 'upload', 'uploaded')
    returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status)
    values (doc, co, 'program', 'gaps_found') returning id into sc;

  -- both values the column is FOR are accepted
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, basis)
    values (sc, doc, co, 1, 'probe read', 'read');
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, basis)
    values (sc, doc, co, 2, 'probe inferred', 'inferred');

  -- ...and a plausible third one is refused
  begin
    insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title, basis)
      values (sc, doc, co, 3, 'probe', 'unknown');
    raise exception 'MIGRATION 041 FAILED: document_gaps.basis accepted "unknown".';
  exception when check_violation then null; end;

  insert into public.fact_proposals (company_id, switch_key, proposed_value, source, document_id, basis)
    values (co, 'probe_key', 'probe', 'document', doc, 'inferred');
  begin
    insert into public.fact_proposals (company_id, switch_key, proposed_value, source, document_id, basis)
      values (co, 'probe_key', 'probe', 'document', doc, 'assumed');
    raise exception 'MIGRATION 041 FAILED: fact_proposals.basis accepted "assumed".';
  exception when check_violation then null; end;

  -- A row that names no basis still inserts, and lands on 'read'. The old callers must not break.
  insert into public.fact_proposals (company_id, switch_key, proposed_value, source, document_id)
    values (co, 'probe_key', 'probe', 'document', doc);
  if not exists (
    select 1 from public.fact_proposals
     where document_id = doc and switch_key = 'probe_key' and basis = 'read'
  ) then
    raise exception 'MIGRATION 041 FAILED: a proposal written without a basis did not default to "read".';
  end if;

  -- and the same for a gap
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title)
    values (sc, doc, co, 4, 'probe default');
  if not exists (
    select 1 from public.document_gaps where document_id = doc and ordinal = 4 and basis = 'read'
  ) then
    raise exception 'MIGRATION 041 FAILED: a gap written without a basis did not default to "read".';
  end if;

  delete from public.documents where id = doc;   -- cascades to the scan, gaps and proposals
  raise notice 'MIGRATION 041: both columns accept read and inferred, refuse a third value, and default to read.';
end $$;

-- GRANTS ARE NOT TOUCHED and do not need to be: §3.6's REVOKE-then-GRANT shape applies to a new
-- TABLE. These are new columns on two tables migration 040 already granted, and a column grant is
-- not separable here — `authenticated` holds select/insert/update on both and now holds it on
-- these columns too, which is what it must have.

commit;
