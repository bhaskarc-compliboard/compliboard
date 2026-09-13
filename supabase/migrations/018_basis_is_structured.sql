-- ============================================================
-- COMPLIBOARD — MIGRATION 018: `basis` BECOMES STRUCTURED
-- ============================================================
--
-- WHY THIS EXISTS.  DECISIONS.md §50.
--
-- `basis` answers "what does this switch value rest on". As text it cannot answer the two
-- questions that matter operationally — *which values rest on this document* and *what did we
-- actually read* — which is the identical argument migration 007 made for
-- `obligations.determined_by`, in its own header: free text "cannot answer either question
-- that matters operationally".
--
-- *** AND THE QUOTE IS THE POINT. *** Phase 7.2 writes a verbatim span from the document into
-- `basis`, and the strongest verification available in that phase is checking that span,
-- character by character, against the document it names. A quote buried in prose cannot be
-- extracted reliably; a quote in a field can. `docs/SWITCH-DETERMINATION.md` §10.3.
--
-- THE EXISTING ROWS ARE CONVERTED, NOT DROPPED. Sixteen rows on staging carry a plain string
-- from the multi-site fixture. Each becomes a `computed` basis with the old text preserved in
-- `reasoning`, so nothing that was written down is lost and every row is valid against the
-- shape the renderer expects.
--
-- *** THIS MIGRATION DOES ONE THING. ***  It was briefly written as one file carrying this
-- change AND an unrelated REVOKE, on the reasoning that two small changes are cheaper as one
-- migration. That was a false economy and it cost something immediately: a migration with two
-- purposes has two honest names, the filename can only carry one, and the half not in the name
-- became invisible in a hand-off. The REVOKE is now migration 019. DECISIONS.md §56.
-- ============================================================

alter table public.company_switches
  alter column basis type jsonb
  using case
    when basis is null then null
    -- Already structured (nothing is yet, but a re-run must be safe).
    when basis like '{%' then basis::jsonb
    else jsonb_build_object(
      'v', 1,
      'kind', 'computed',
      'at', to_char(coalesce(updated_at, created_at, now()), 'YYYY-MM-DD'),
      'reasoning', basis)
  end;

comment on column public.company_switches.basis is
  $c$WHAT THIS VALUE RESTS ON, structured. { v, kind: user_answer|document|computed, at, and
per-kind fields: question/previous_value · document_id/locator/quote/reasoning · computed_from }.
The sentence a person reads is produced by renderBasis() in lib/basis.ts and is NEVER stored —
one place to change the wording, and the two cannot drift. jsonb rather than text because prose
cannot answer "which switches rest on this document" and cannot yield a quote for
character-by-character checking against its source. DECISIONS.md §50.$c$;

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare t text; n bigint; bad bigint;
begin
  select udt_name into t from information_schema.columns
   where table_schema='public' and table_name='company_switches' and column_name='basis';
  if t <> 'jsonb' then
    raise exception 'MIGRATION 018 FAILED: basis is %, not jsonb.', t;
  end if;

  select count(*) into n from public.company_switches where basis is not null;
  select count(*) into bad from public.company_switches
   where basis is not null
     and (basis->>'v' is null or basis->>'kind' is null or basis->>'at' is null);
  if bad > 0 then
    raise exception 'MIGRATION 018 FAILED: % of % converted rows lack v, kind or at.', bad, n;
  end if;
  raise notice 'MIGRATION 018 OK: basis is jsonb; % row(s) converted and all well-formed.', n;
end $$;
