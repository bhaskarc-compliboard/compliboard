-- ===========================================================================
-- 060 — A RECURRING DATE NEED NOT HAVE A DAY
-- ===========================================================================
-- WHY.
--
-- 058 says a date carries a date:
--
--     constraint audit_findings_date_has_a_date check (kind <> 'date' or due_on is not null)
--
-- which is the right rule for a deadline and the wrong rule for an obligation. The rev 1 baseline
-- (`tests/golden/audits/bakeoff/RESULTS.md`, 30 September 2026) measured what it costs. Across
-- fifteen runs the model returned eighteen date items shaped like this:
--
--     {"title": "Annual permit fee (Condition 6.2)", "due_on": null, "recurs": true,
--      "document": "D5", "passed": false}
--
-- True, useful, and with no day in it, because the permit says the fee is annual and names no date —
-- the invoice carries it. The CHECK refuses that row, so `lib/auditRun.ts` demoted it to a plain
-- finding, and a `dates` item carries no `word` field, so what landed was a finding with **no word at
-- all**: a title, a document, and nothing else, rendered at the top of FINDINGS above the things that
-- really are missing. 23 of them in fifteen runs, Haiku's batches included — the shaping, not the
-- model.
--
-- Three ways out, and only one of them is honest.
--
--   Invent a day. "Annual, so call it 31 December." That is a deadline nobody set, on a screen whose
--   whole promise is that every line points at a document or says what we do not see.
--   Drop the item. Cheaper, and it throws away the one thing the reading got right: the obligation
--   recurs and the company has no record of the last one.
--   Let a RECURRING date have no day. The row says what the document says: this comes round, we
--   cannot tell you when from what you have given us.
--
-- So the CHECK is narrowed by exactly one case:
--
--     kind <> 'date' or due_on is not null or recurs is true
--
-- A NON-recurring date with no day is still refused, and that refusal is the point of keeping the
-- constraint at all: "the permit expires" with no date is a reading that failed, and it must not be
-- storable. `lib/auditRun.ts` drops those and counts them as `dropped_undated` beside
-- `reshaped_to_dates`, so a rule firing in code can still be seen firing.
--
-- WHY `recurs is true` AND NOT `coalesce(recurs, false)`. `recurs` is nullable and null means the
-- model did not say. A row with no day and no claim that it recurs is not a recurring obligation; it
-- is a date the reading could not finish. Writing the condition this way makes null behave like
-- false, which is what is wanted, and says so out loud — CLAUDE.md §3.7's NULL trap pointing the
-- other way for once.
--
-- NOTHING ELSE CHANGES. No column is added, no privilege is touched, and the rows already in the
-- table all satisfy the looser rule by construction: a constraint is only ever widened here, so no
-- existing row can be made illegal by it.
-- ===========================================================================

alter table public.audit_findings
  drop constraint if exists audit_findings_date_has_a_date;

alter table public.audit_findings
  add constraint audit_findings_date_has_a_date check (
    kind <> 'date' or due_on is not null or recurs is true
  );

comment on constraint audit_findings_date_has_a_date on public.audit_findings is
  'A date carries a day, unless it recurs: an annual obligation whose day the documents do not name '
  'is still a real obligation. A non-recurring date with no day is a reading that did not finish '
  'and is refused. Migration 060.';

-- ===========================================================================
-- VERIFY — the new case is accepted, every old refusal still refuses.
-- CLAUDE.md §3.7: a constraint nobody has tried to break is a comment.
-- ===========================================================================
do $$
declare
  co uuid; site uuid; doc uuid; run uuid; sec uuid; f uuid; n int;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 060 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.entities (company_id, entity_type, name, details)
       values (co, 'site', 'Portland', '{}'::jsonb) returning id into site;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'probe-060-permit.pdf', 'probe/060', 'application/pdf') returning id into doc;
  insert into public.audit_runs (company_id, entity_id, kind, agency_label)
       values (co, site, 'agency', 'Oregon DEQ') returning id into run;
  insert into public.audit_sections (run_id, company_id, ordinal, title)
       values (run, co, 0, 'Oregon DEQ') returning id into sec;

  -- ---- 1. THE CASE THIS MIGRATION EXISTS FOR: recurring, no day. ----
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                     document_id, due_on, recurs, passed)
       values (run, sec, co, 0, 'date', 'Annual permit fee (Condition 6.2)',
               doc, null, true, false)
       returning id into f;
  if (select due_on from public.audit_findings where id = f) is not null then
    raise exception 'MIGRATION 060 FAILED: a null due_on did not store as null.';
  end if;
  if (select recurs from public.audit_findings where id = f) is not true then
    raise exception 'MIGRATION 060 FAILED: recurs did not store as true.';
  end if;
  -- And it is a DATE, not a finding: the whole point is that it stops arriving as a wordless finding.
  if (select kind from public.audit_findings where id = f) <> 'date' then
    raise exception 'MIGRATION 060 FAILED: the recurring undated row is not kind date.';
  end if;
  -- A date carries no word, and must not be required to.
  if (select word from public.audit_findings where id = f) is not null then
    raise exception 'MIGRATION 060 FAILED: a date came back carrying a word.';
  end if;

  -- ---- 2. NON-RECURRING WITH NO DAY IS STILL REFUSED. ----
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       due_on, recurs)
         values (run, sec, co, 1, 'date', 'Permit 26-2841-ST-01 expires', null, false);
    raise exception 'MIGRATION 060 FAILED: a one-off date with no day was accepted.';
  exception when check_violation then null; end;

  -- ---- 3. AND recurs NULL — "the model did not say" — IS REFUSED TOO. ----
  -- This is the clause the comment above is about. If it were written coalesce(recurs, false) the
  -- behaviour would be the same; if it were written `recurs is not false` this insert would pass,
  -- and a date the reading could not finish would be storable.
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       due_on, recurs)
         values (run, sec, co, 2, 'date', 'Something due, we could not tell when', null, null);
    raise exception 'MIGRATION 060 FAILED: a date with no day and no recurs claim was accepted.';
  exception when check_violation then null; end;

  -- ---- 4. A DATE WITH A DAY IS UNAFFECTED, recurring or not. ----
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                     due_on, recurs)
       values (run, sec, co, 3, 'date', 'Permit expires', '2026-11-15', false);
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                     due_on, recurs)
       values (run, sec, co, 4, 'date', 'Annual report', '2027-02-15', true);
  select count(*) into n from public.audit_findings where run_id = run and kind = 'date';
  if n <> 3 then
    raise exception 'MIGRATION 060 FAILED: expected three date rows to have landed, found %.', n;
  end if;

  -- ---- 5. THE OTHER TWO PER-KIND CHECKS ARE NOT WEAKENED. ----
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       document_b_id, value_a, value_b, recurs)
         values (run, sec, co, 5, 'contradiction', 'half a contradiction', null, '42', null, true);
    raise exception 'MIGRATION 060 FAILED: a half-built contradiction was accepted.';
  exception when check_violation then null; end;
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       basis, word, recurs)
         values (run, sec, co, 6, 'expected', 'an expected item with the wrong word',
                 'expected', 'on_file', true);
    raise exception 'MIGRATION 060 FAILED: an expected row with the wrong word was accepted.';
  exception when check_violation then null; end;

  -- ---- 6. THE CROSS-TENANT RULE 058 ADDED STILL HOLDS. ----
  -- A looser date rule must not have become a way in: the composite FK is what stops a finding
  -- citing another company's document, and RLS cannot catch it.
  declare coB uuid; docB uuid;
  begin
    insert into public.companies (name, industry, state)
         values ('Migration 060 probe B', 'chemical manufacturing', 'OR') returning id into coB;
    insert into public.documents (company_id, name, file_url, file_type)
         values (coB, 'not-yours.pdf', 'probe/060b', 'application/pdf') returning id into docB;
    begin
      insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                         document_id, due_on, recurs)
           values (run, sec, co, 7, 'date', 'another company''s document', docB, null, true);
      raise exception 'MIGRATION 060 FAILED: a recurring undated date cited another company''s document.';
    exception when foreign_key_violation then null; end;
    delete from public.companies where id = coB;
  end;

  -- ---- 7. PRIVILEGES, READ BACK. A constraint change must move nothing. ----
  if has_table_privilege('anon', 'public.audit_findings', 'SELECT')
     or has_table_privilege('anon', 'public.audit_findings', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_findings', 'INSERT') then
    raise exception 'MIGRATION 060 FAILED: changing a constraint changed who holds what.';
  end if;
  if not has_table_privilege('authenticated', 'public.audit_findings', 'SELECT')
     or not has_table_privilege('authenticated', 'public.audit_findings', 'UPDATE') then
    raise exception 'MIGRATION 060 FAILED: a privilege audit_findings needs has gone.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 060 VERIFIED: a recurring date may have no day; a one-off with no day, and '
    'one whose recurrence nobody claimed, are both still refused; the other per-kind CHECKs, the '
    'cross-tenant FK and every privilege are unchanged.';
end $$;
