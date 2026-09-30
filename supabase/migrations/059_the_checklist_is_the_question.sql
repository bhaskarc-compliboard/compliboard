-- ===========================================================================
-- 059 — A CHECKLIST IS THE QUESTION, AND ITS LINES ARE THE ANSWER'S SHAPE
-- ===========================================================================
-- WHY.
--
-- An agency audit asks "what does this regulator want, and what have we got" and the regulator's
-- wants come out of the documents' own conditions. A TEMPLATE audit is the other direction: somebody
-- hands us a checklist — their auditor's field form, or their own monthly sheet — and the question is
-- already written down. Fifteen lines, each of which we either have a document for or do not.
--
-- That changes what a finding has to carry. An agency finding is free to be titled however the
-- reading puts it. A template finding has to be traceable to the LINE it answers, or the report
-- cannot be read beside the checklist the person handed us — and being able to hold the two side by
-- side is the entire value of the feature. So:
--
--   audit_findings.template_line   the checklist's own reference, as printed: "A2", "B4", "7".
--   audit_findings.template_text   that line as written, so the report reads back what was asked
--                                  rather than our paraphrase of it.
--
-- WHY THE TEXT AND NOT JUST THE REFERENCE. A reference means nothing on its own — "A2" is only a
-- question if you have the form in front of you. Storing the line makes the report self-contained,
-- which matters most in the case it exists for: printing it and handing it to an inspector.
--
--   audit_runs.template_lines      the sections and lines as extracted, kept WITH THE RUN.
--
-- WHY ON THE RUN AND NOT DERIVED EACH TIME. Extracting the lines is a model call over the attached
-- file. A re-audit against the same checklist must ask the same questions in the same order, or
-- "what changed since last time" compares two different questionnaires — and it would pay for the
-- extraction again to do it. The run holds what it was asked, the way `audit_sections` holds the
-- input hash: a stored question is what makes two runs comparable.
--
-- BOTH COLUMNS ARE NULLABLE AND NOTHING ENFORCES THEM PER KIND. A `template` run's findings carry
-- them and an `agency` run's do not, and a CHECK tying `template_line` to the run's kind would have
-- to reach through `audit_findings` to `audit_runs` — a subquery in a CHECK, which Postgres will not
-- have. The rule lives in `lib/auditRun.ts`, which is the only writer, and the template drawer
-- simply shows nothing where there is nothing.
-- ===========================================================================

alter table public.audit_findings
  add column if not exists template_line text,
  add column if not exists template_text text;

comment on column public.audit_findings.template_line is
  'The checklist reference this finding answers, as printed on the form: A2, B4, 7. Null on an agency audit.';
comment on column public.audit_findings.template_text is
  'That checklist line as written, so the report is readable without the form beside it.';

alter table public.audit_runs
  add column if not exists template_lines jsonb;

comment on column public.audit_runs.template_lines is
  'The sections and lines extracted from the attached checklist, kept with the run so a re-audit asks the same questions in the same order.';

-- The template drawer groups by section and orders by the checklist's own order, which is `ordinal`.
-- Company-leading, as every index here is.
create index if not exists idx_audit_findings_template_line
  on public.audit_findings (company_id, run_id, template_line);

-- ===========================================================================
-- VERIFY. Every constraint tested by trying to break it (§3.7), privileges read back.
-- ===========================================================================
do $$
declare
  co uuid; site uuid; doc uuid; runA uuid; secA uuid; f uuid; n int; lines jsonb;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 059 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.entities (company_id, entity_type, name, details)
       values (co, 'site', 'Portland', '{}'::jsonb) returning id into site;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'probe-059-checklist.docx', 'probe/059',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
       returning id into doc;

  -- ---- a template run carries its document and its lines ----
  lines := '[{"title":"A. Permit and submissions","lines":[
              {"ref":"A1","text":"Current ACDP on file"},
              {"ref":"A2","text":"Renewal application submitted at least 120 days before expiry"}]}]'::jsonb;
  insert into public.audit_runs (company_id, entity_id, kind, template_document_id, template_lines)
       values (co, site, 'template', doc, lines) returning id into runA;

  if (select template_lines from public.audit_runs where id = runA) is null then
    raise exception 'MIGRATION 059 FAILED: template_lines did not store.';
  end if;
  if jsonb_array_length((select template_lines -> 0 -> 'lines' from public.audit_runs where id = runA)) <> 2 then
    raise exception 'MIGRATION 059 FAILED: the stored lines did not come back as two.';
  end if;

  -- 058's rule still holds: a template run may not also claim an agency.
  begin
    insert into public.audit_runs (company_id, kind, template_document_id, agency_label)
         values (co, 'template', doc, 'Oregon DEQ');
    raise exception 'MIGRATION 059 FAILED: a template run was allowed to claim an agency as well.';
  exception when check_violation then null; end;

  -- ---- one section per checklist section ----
  insert into public.audit_sections (run_id, company_id, ordinal, title)
       values (runA, co, 0, 'A. Permit and submissions') returning id into secA;

  -- ---- a finding that answers a line ----
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                     word, basis, template_line, template_text)
       values (runA, secA, co, 0, 'finding', 'Renewal application', 'nothing_on_file', 'read',
               'A2', 'Renewal application submitted at least 120 days before expiry')
       returning id into f;
  if (select template_line from public.audit_findings where id = f) <> 'A2' then
    raise exception 'MIGRATION 059 FAILED: template_line did not store.';
  end if;

  -- An agency finding leaves both null, and that is legal: the columns are per-kind by the writer,
  -- not by a constraint (a CHECK cannot reach the run's kind).
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title, word)
       values (runA, secA, co, 1, 'finding', 'something with no checklist line', 'on_file');
  select count(*) into n from public.audit_findings
   where run_id = runA and template_line is null;
  if n <> 1 then
    raise exception 'MIGRATION 059 FAILED: expected one finding with no template_line, found %.', n;
  end if;

  -- ---- the cross-tenant rule 058 added is not weakened by the new columns ----
  declare coB uuid; docB uuid;
  begin
    insert into public.companies (name, industry, state)
         values ('Migration 059 probe B', 'chemical manufacturing', 'OR') returning id into coB;
    insert into public.documents (company_id, name, file_url, file_type)
         values (coB, 'probe-059-b.pdf', 'probe/059b', 'application/pdf') returning id into docB;
    begin
      insert into public.audit_runs (company_id, kind, template_document_id)
           values (co, 'template', docB);
      raise exception 'MIGRATION 059 FAILED: a template run took another company''s document.';
    exception when foreign_key_violation then null; end;
    delete from public.companies where id = coB;
  end;

  -- ---- deleting the run takes its findings, and the document survives ----
  delete from public.audit_runs where id = runA;
  select count(*) into n from public.audit_findings where run_id = runA;
  if n <> 0 then raise exception 'MIGRATION 059 FAILED: findings outlived their run.'; end if;
  select count(*) into n from public.documents where id = doc;
  if n <> 1 then raise exception 'MIGRATION 059 FAILED: deleting a run deleted its checklist.'; end if;

  -- ---- privileges, READ BACK: the new columns must not have widened anything ----
  if has_table_privilege('anon', 'public.audit_findings', 'SELECT')
     or has_table_privilege('anon', 'public.audit_runs', 'SELECT')
     or has_table_privilege('authenticated', 'public.audit_findings', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_runs', 'INSERT') then
    raise exception 'MIGRATION 059 FAILED: adding a column changed who holds what.';
  end if;
  if not has_table_privilege('authenticated', 'public.audit_findings', 'SELECT')
     or not has_table_privilege('authenticated', 'public.audit_runs', 'UPDATE') then
    raise exception 'MIGRATION 059 FAILED: a privilege the audit tables need has gone.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 059 VERIFIED: two columns on audit_findings, one on audit_runs, every refusal held.';
end $$;
