-- ===========================================================================
-- 061 — THE SAME FINDING, FROM TWO SECTIONS
-- ===========================================================================
-- WHY.
--
-- The owner's smoke test of Audits rev 1 ran "Audit everything" on production: three sections — FDA,
-- Oregon Department of Agriculture, Oregon OSHA — over two documents, 43 findings. The review found
-- **the same finding twice, from two sections.**
--
-- That is not a bug in the model. Two regulators genuinely want the same record: a training log that
-- OSHA wants for its own rule and the Department of Agriculture wants for its own. Each section is a
-- separate call that is shown the same filing cabinet, neither is told what the other said — on
-- purpose, so a section can be re-run on its own — and both correctly say the record is not on file.
-- Both are right. Printing both is what is wrong: the person reads one report, and one report that
-- says the same thing twice reads as a report that has not been looked at.
--
-- WHAT THIS ADDS.
--
--   audit_findings.also_in_sections uuid[]   the OTHER sections that raised the same thing.
--
-- The surviving row carries the sections it is also true of, so the drawer can show it once under
-- each agency with "also under <the other agency>" beside it. The duplicate rows are **closed, never
-- deleted** — `status = 'closed'` with `closed_reason = 'same as <id> from another section'` — which
-- is the same rule `audit_findings` has carried since 058 and the same rule `obligations` has: a row
-- that was written is evidence that it was written, and a report that silently drops a model's output
-- cannot be audited afterwards.
--
-- WHY AN ARRAY AND NOT A SECOND TABLE. A join table is the right shape for a many-to-many that
-- carries its own facts — when, by whom, why. This carries none: it is "these section ids, too". The
-- array is read in the same row as the finding, which is how the drawer reads it, and a `uuid[]`
-- needs no index to be useful at the handful of sections a run has. `documents_read` on
-- `audit_sections` is the same decision for the same reason.
--
-- WHY NOT A FOREIGN KEY. Postgres cannot put a foreign key on an array element. The ids are written
-- only by `lib/auditRun.ts`, from sections of the run being finished, and the sections themselves are
-- deleted with the run — so a stale id here would mean the whole run is gone and the row with it.
-- Stated out loud because an unenforced reference is a thing a reader should know is unenforced.
--
-- DEFAULT '{}' AND NOT NULL: an empty array is "nothing else raised this", which is true of almost
-- every finding, and `cardinality()` on it is 0 rather than NULL. CLAUDE.md §3.7's NULL trap — the
-- one that shipped once in migration 008 — is about exactly this.
-- ===========================================================================

alter table public.audit_findings
  add column if not exists also_in_sections uuid[] not null default '{}'::uuid[];

comment on column public.audit_findings.also_in_sections is
  'Other audit_sections of the same run that raised this same finding. The surviving row of a '
  'collapse carries them; the duplicates are status=closed with a closed_reason naming this row. '
  'Not a foreign key: Postgres cannot constrain an array element. Migration 061.';

-- ===========================================================================
-- VERIFY — the column stores, the collapse is expressible, and nothing else moved.
-- CLAUDE.md §3.7: a constraint nobody has tried to break is a comment.
-- ===========================================================================
do $$
declare
  co uuid; site uuid; doc uuid; run uuid; secA uuid; secB uuid; keeper uuid; dupe uuid; n int;
  arr uuid[];
begin
  insert into public.companies (name, industry, state)
       values ('Migration 061 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.entities (company_id, entity_type, name, details)
       values (co, 'site', 'Portland', '{}'::jsonb) returning id into site;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'probe-061.pdf', 'probe/061', 'application/pdf') returning id into doc;
  insert into public.audit_runs (company_id, entity_id, kind, agency_label, section_count)
       values (co, site, 'agency', 'Oregon OSHA · Oregon Department of Agriculture', 2) returning id into run;
  insert into public.audit_sections (run_id, company_id, ordinal, title)
       values (run, co, 0, 'Oregon OSHA') returning id into secA;
  insert into public.audit_sections (run_id, company_id, ordinal, title)
       values (run, co, 1, 'Oregon Department of Agriculture') returning id into secB;

  -- ---- 1. THE DEFAULT IS AN EMPTY ARRAY, NOT NULL. ----
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title, word,
                                     document_id, locator)
       values (run, secA, co, 0, 'finding', 'Forklift operator training records', 'nothing_on_file',
               doc, 'page 2')
       returning id into keeper;
  select also_in_sections into arr from public.audit_findings where id = keeper;
  if arr is null then
    raise exception 'MIGRATION 061 FAILED: also_in_sections came back NULL, not an empty array.';
  end if;
  if cardinality(arr) <> 0 then
    raise exception 'MIGRATION 061 FAILED: a new finding started with % section(s) in its array.', cardinality(arr);
  end if;

  -- ---- 2. THE SECOND SECTION'S COPY, AND THE COLLAPSE. ----
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title, word,
                                     document_id, locator)
       values (run, secB, co, 1, 'finding', 'Training records for forklift operators', 'nothing_on_file',
               doc, 'page 2')
       returning id into dupe;

  update public.audit_findings set also_in_sections = array[secB] where id = keeper;
  update public.audit_findings
     set status = 'closed', closed_reason = 'same as ' || keeper::text || ' from another section',
         closed_by_run_id = run
   where id = dupe;

  select also_in_sections into arr from public.audit_findings where id = keeper;
  if cardinality(arr) <> 1 or arr[1] <> secB then
    raise exception 'MIGRATION 061 FAILED: the keeper did not carry the other section id.';
  end if;
  if (select status from public.audit_findings where id = dupe) <> 'closed' then
    raise exception 'MIGRATION 061 FAILED: the duplicate was not closed.';
  end if;
  if (select closed_reason from public.audit_findings where id = dupe) not like 'same as %' then
    raise exception 'MIGRATION 061 FAILED: the duplicate carries no reason naming the row it duplicates.';
  end if;
  -- *** AND IT IS STILL THERE. *** The whole point: a collapse closes a row, it never deletes one.
  select count(*) into n from public.audit_findings where run_id = run;
  if n <> 2 then
    raise exception 'MIGRATION 061 FAILED: expected both rows to survive the collapse, found %.', n;
  end if;

  -- ---- 3. `status` STILL REFUSES A WORD IT DOES NOT KNOW. ----
  begin
    update public.audit_findings set status = 'collapsed' where id = dupe;
    raise exception 'MIGRATION 061 FAILED: an unknown status was accepted.';
  exception when check_violation then null; end;

  -- ---- 4. AN ARRAY OF SECTIONS IS NOT A WAY ROUND THE PER-KIND CHECKS. ----
  begin
    insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title,
                                       due_on, recurs, also_in_sections)
         values (run, secA, co, 2, 'date', 'a one-off with no day', null, false, array[secB]);
    raise exception 'MIGRATION 061 FAILED: 060''s date rule was bypassed by a row with an array.';
  exception when check_violation then null; end;

  -- ---- 5. NOR ROUND THE CROSS-TENANT RULE 058 ADDED. ----
  declare coB uuid; docB uuid;
  begin
    insert into public.companies (name, industry, state)
         values ('Migration 061 probe B', 'chemical manufacturing', 'OR') returning id into coB;
    insert into public.documents (company_id, name, file_url, file_type)
         values (coB, 'not-yours.pdf', 'probe/061b', 'application/pdf') returning id into docB;
    begin
      insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title, word,
                                         document_id, also_in_sections)
           values (run, secA, co, 3, 'finding', 'another company''s document', 'nothing_on_file',
                   docB, array[secB]);
      raise exception 'MIGRATION 061 FAILED: a finding with an array cited another company''s document.';
    exception when foreign_key_violation then null; end;
    delete from public.companies where id = coB;
  end;

  -- ---- 6. DELETING THE RUN TAKES BOTH ROWS, CLOSED ONE INCLUDED. ----
  delete from public.audit_runs where id = run;
  select count(*) into n from public.audit_findings where run_id = run;
  if n <> 0 then raise exception 'MIGRATION 061 FAILED: findings outlived their run.'; end if;

  -- ---- 7. PRIVILEGES, READ BACK. Adding a column is a chance to widen one by accident. ----
  if has_table_privilege('anon', 'public.audit_findings', 'SELECT')
     or has_table_privilege('anon', 'public.audit_findings', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_findings', 'INSERT') then
    raise exception 'MIGRATION 061 FAILED: adding a column changed who holds what.';
  end if;
  if not has_table_privilege('authenticated', 'public.audit_findings', 'SELECT')
     or not has_table_privilege('authenticated', 'public.audit_findings', 'UPDATE') then
    raise exception 'MIGRATION 061 FAILED: a privilege audit_findings needs has gone.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 061 VERIFIED: also_in_sections defaults to an empty array, a collapse '
    'closes the duplicate and keeps it, an unknown status is refused, and neither 060''s date rule '
    'nor 058''s cross-tenant key is bypassed by a row that carries an array.';
end $$;
