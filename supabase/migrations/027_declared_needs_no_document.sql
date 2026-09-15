-- ============================================================
-- COMPLIBOARD — MIGRATION 027: `declared` NEEDS NO DOCUMENT
-- ============================================================
--
-- WHY THIS IS SEPARATE FROM 026.  Postgres refuses to use an enum value in the same transaction
-- that added it — `ALTER TYPE ... ADD VALUE` must commit first. 026 adds the word; this file is
-- the first statement allowed to name it. Two migrations, one reason, and it is a Postgres rule
-- rather than a style choice.
--
-- WHAT CHANGES.  017's constraint requires a document and a quote for `stated` and `implied`,
-- because both mean "this document says it". **`declared` means a person told us**, so it
-- requires neither — its provenance is the person and the timestamp in `basis`.
--
-- The constraint is REPLACED rather than widened with an OR on `source`: the rule is about what
-- the evidence CLASS means, and keeping it expressed that way is what lets 017's comment stay
-- true.
-- ============================================================

alter table public.switch_determinations
  drop constraint switch_determinations_stated_needs_evidence;

-- `stated` and `implied` still mean "this document says/implies it" and still require both.
-- `inferred` may span several documents, so it does not. `declared` has no document by
-- definition. `absent` asserts nothing.
alter table public.switch_determinations
  add constraint switch_determinations_stated_needs_evidence
  check (
    evidence_class <> all (array['stated'::public.evidence_class, 'implied'::public.evidence_class])
    or (document_id is not null and quote is not null)
  );

-- *** AND THE OTHER HALF, WHICH 017 DID NOT NEED AND THIS DOES. ***
-- A `declared` determination that carries a document is a contradiction: if a document is the
-- source, the class is `stated`, `implied` or `inferred`. Without this, `declared` becomes the
-- class that escapes every evidence rule, which is how a vocabulary rots.
alter table public.switch_determinations
  add constraint switch_determinations_declared_has_no_document
  check (evidence_class <> 'declared'::public.evidence_class
         or (document_id is null and quote is null));

-- ------------------------------------------------------------
-- VERIFY — by VIOLATING each constraint, not by asserting it exists.
-- CLAUDE.md §3.7: a constraint nobody has tried to break is a comment.
-- ------------------------------------------------------------
do $$
declare v_company uuid; v_ok boolean;
begin
  select id into v_company from public.companies limit 1;
  if v_company is null then
    raise notice 'MIGRATION 027: no company to test against; constraints added but not exercised.';
    return;
  end if;

  -- 1. `declared` with no document must be ACCEPTED.
  begin
    insert into public.switch_determinations (company_id, switch_id, value, evidence_class, source)
    values (v_company, '__probe__', 'true', 'declared', 'user_set');
    raise exception 'MIGRATION 027 FAILED: a probe row inserted against a switch that does not exist.';
  exception
    when foreign_key_violation then
      null;  -- reached the FK, so the CHECK let it through. That is what we are testing.
    when check_violation then
      raise exception 'MIGRATION 027 FAILED: `declared` with no document was refused by a CHECK.';
  end;

  -- 2. `declared` WITH a document must be REFUSED.
  v_ok := false;
  begin
    insert into public.switch_determinations (company_id, switch_id, value, evidence_class, source, document_id, quote)
    values (v_company, '__probe__', 'true', 'declared', 'user_set', gen_random_uuid(), 'x');
  exception
    when check_violation then v_ok := true;
    when others then v_ok := false;
  end;
  if not v_ok then
    raise exception 'MIGRATION 027 FAILED: `declared` carrying a document was not refused.';
  end if;

  raise notice 'MIGRATION 027 OK: `declared` needs no document and may not carry one. Both tried.';
end $$;
