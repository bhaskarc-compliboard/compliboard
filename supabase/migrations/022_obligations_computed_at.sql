-- ============================================================
-- COMPLIBOARD — MIGRATION 022: HAS THIS COMPANY'S LIST EVER BEEN WORKED OUT?
-- ============================================================
--
-- WHY.  Phase 4.3 writes obligations LAZILY — on the first request for them, not at signup.
-- That leaves M7 free to trigger a write at signup later if it turns out to be right; writing
-- eagerly would take the choice away, and would show a brand-new company ~200 rows that are
-- almost all `unknown` before they have answered a single question. `DECISIONS.md` §60.
--
-- *** WHICH CREATES A STATE THE SCHEMA COULD NOT OTHERWISE EXPRESS. ***
--
--   obligations = 0 AND never computed  ->  "we have not worked this out yet"
--   obligations = 0 AND computed        ->  "we worked it out and nothing applies"
--
-- Those are different sentences, and a customer must not see the second when the first is
-- true. `CLAUDE.md` §5.1 — an empty state is a claim and it has to be true; "nothing applies
-- to you" asserted by a screen that has computed nothing is the omniscient status tracker in
-- its purest form.
--
-- A row count cannot tell them apart. A timestamp can, and it is the only thing that can.
--
-- NULLABLE ON PURPOSE. NULL *is* the never-computed state — it is not missing data. Every
-- existing company is correctly NULL: nothing has ever written an obligation.
-- ============================================================

alter table public.companies
  add column obligations_computed_at timestamptz;

comment on column public.companies.obligations_computed_at is
  $c$When this company's obligations were last resolved. NULL means NEVER — which is a
different state from "computed, and nothing applies", and a row count cannot distinguish them.
Set by the obligation writer (Phase 4.3) after close_and_replace_obligations returns. M6 reads
it to choose between "we have not worked out your requirements yet" and an empty list.
DECISIONS.md §60; CLAUDE.md §5.1.$c$;

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare t text; n bigint; nulls bigint;
begin
  select data_type into t from information_schema.columns
   where table_schema='public' and table_name='companies' and column_name='obligations_computed_at';
  if t is null then
    raise exception 'MIGRATION 022 FAILED: obligations_computed_at was not added.';
  end if;
  if t <> 'timestamp with time zone' then
    raise exception 'MIGRATION 022 FAILED: obligations_computed_at is %, not timestamptz.', t;
  end if;

  select count(*), count(*) filter (where obligations_computed_at is null) into n, nulls
    from public.companies;
  if n <> nulls then
    raise exception 'MIGRATION 022 FAILED: % of % companies are non-NULL, but nothing has ever written an obligation.', n - nulls, n;
  end if;

  raise notice 'MIGRATION 022 OK: obligations_computed_at added; all % companies correctly NULL (never computed).', n;
end $$;
