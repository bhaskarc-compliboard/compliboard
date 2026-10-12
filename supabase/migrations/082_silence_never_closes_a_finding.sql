-- ===========================================================================
-- 082 — SILENCE NEVER CLOSES A FINDING
--
-- The owner's decision **D1**, 12 October 2026
-- (`docs/reports/jobE-independent-review.md` §7), out of E9 item 3 and N2/N3.
--
-- **WHY: "Audit again" closed findings the newer audit had just raised again.**
--
-- Measured, on real runs, in E9 item 3: two audits of one agency, 3 previous
-- findings closed as **"not raised by the newer audit"**, and not one of them
-- was closed because the title was worded differently. One was closed while the
-- newer audit raised that exact title — the model's `same_as` had pointed at a
-- row of a DIFFERENT KIND, nothing checked that the kinds agreed, so the lookup
-- missed and the real match was closed. The other two were a `[date]` and an
-- `[expected]`, which only a `findings` item can claim at all
-- (`prompts/audit-agency.ts` gives `same_as` to that one list), so every re-audit
-- closed them and raised them again: four open rows for two obligations.
--
-- A close is a claim to a customer — "we checked, and this is no longer raised" —
-- it goes in the email, and a person cannot undo it. So:
--
--   **Only evidence closes. Silence moves an item to a group and asks.**
--
-- **WHAT THESE COLUMNS ARE.**
--
--   · `not_raised_by_run_id` — the newer run that did NOT match this older
--     finding. The row **stays open**; this is what lets the newer run's report
--     gather those rows under "Not raised in this audit" with a "Close it"
--     button, instead of closing them itself. ON DELETE SET NULL, like
--     `closed_by_run_id`: deleting a run must not take the finding with it.
--   · `closed_by` — the login that pressed "Close it". NULL for every close the
--     audit made on the evidence.
--   · `closed_at` — when. `closed_by_run_id` dates a close by its run, and a
--     person's close has no run, so the date needs a column of its own. The page
--     renders the two together: "Closed by <name> on <date>", with **Reopen**.
--
-- **WHY NOT A NEW `status`.** `status` is read in ten places as open / closed /
-- dismissed, and a fourth value would mean every one of them has to be found and
-- taught about it — including the ones that decide what a person is shown and
-- what the email counts. A not-raised finding IS open: that is the whole
-- decision. So the state is a pointer to the run that went quiet about it, and
-- every existing reader of `status` keeps being right.
--
-- Nothing is backfilled. Production carries 70 findings from one run and none
-- closed (read on 12 October 2026, E10's report), so there is nothing in that
-- state to repair; staging's two E9 runs are cleared by E10 itself.
--
-- No grant is needed: a new column carries the table's own grants, and
-- `audit_findings` was granted in migration 057 and re-read in 066–068.
-- ===========================================================================

begin;

alter table public.audit_findings add column if not exists not_raised_by_run_id uuid
  references public.audit_runs(id) on delete set null;
alter table public.audit_findings add column if not exists closed_by uuid
  references auth.users(id) on delete set null;
alter table public.audit_findings add column if not exists closed_at timestamptz;

comment on column public.audit_findings.not_raised_by_run_id is
  'The newer run that did not match this older finding (the owner''s decision D1, migration 082). '
  'The finding STAYS OPEN: this is what gathers it under "Not raised in this audit" on that run''s '
  'report, with a Close it button, instead of the audit closing it on its own silence. NULL for '
  'every finding no newer run has gone quiet about.';
comment on column public.audit_findings.closed_by is
  'The login that pressed "Close it". NULL for a close the audit made on the evidence, which is '
  'every close before 12 October 2026.';
comment on column public.audit_findings.closed_at is
  'When it was closed. closed_by_run_id dates a close by its run; a person''s close has no run, '
  'so it needs its own. The page shows "Closed by <name> on <date>" with Reopen.';

-- The report reads the not-raised group by the run looking at it, so that one is indexed; the
-- other two are read from rows the same query has already returned.
create index if not exists idx_audit_findings_not_raised_by_run
  on public.audit_findings (not_raised_by_run_id) where not_raised_by_run_id is not null;

-- ===========================================================================
-- VERIFY — §3.7: the three columns, both deletion rules, that a not-raised
-- finding is still OPEN, and that a person's close and an audit's close can be
-- told apart.
-- ===========================================================================
do $$
declare co uuid; r1 uuid; r2 uuid; s1 uuid; f uuid; n int; v text;
begin
  for v in select unnest(array['not_raised_by_run_id', 'closed_by', 'closed_at']) loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'audit_findings' and column_name = v
    ) then
      raise exception 'MIGRATION 082 FAILED: audit_findings.% is not there.', v;
    end if;
  end loop;

  -- Both foreign keys must SET NULL, or deleting a run or an account destroys the finding.
  select count(*) into n
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'public.audit_findings'::regclass
     and c.contype = 'f' and c.confdeltype = 'n'
     and a.attname in ('not_raised_by_run_id', 'closed_by');
  if n <> 2 then
    raise exception 'MIGRATION 082 FAILED: expected 2 ON DELETE SET NULL keys (not_raised_by_run_id, closed_by), found %.', n;
  end if;

  if not exists (select 1 from pg_indexes
                  where schemaname = 'public' and indexname = 'idx_audit_findings_not_raised_by_run') then
    raise exception 'MIGRATION 082 FAILED: the not-raised group has no index, and the report reads it by that column.';
  end if;

  insert into public.companies (name) values ('082 probe') returning id into co;
  -- `agency_label` is NOT NULL on an agency run: `audit_runs_kind_has_its_subject` requires each
  -- kind to carry its own subject and nothing else. Found by the constraint refusing the insert.
  insert into public.audit_runs (company_id, kind, status, section_count, done_count, agency_label)
       values (co, 'agency', 'done', 1, 1, 'Oregon DEQ') returning id into r1;
  insert into public.audit_runs (company_id, kind, status, section_count, done_count, agency_label, previous_run_id)
       values (co, 'agency', 'done', 1, 1, 'Oregon DEQ', r1) returning id into r2;
  insert into public.audit_sections (run_id, company_id, ordinal, title, status)
       values (r1, co, 0, 'Oregon DEQ', 'done') returning id into s1;
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title)
       values (r1, s1, co, 0, 'finding', '082 probe finding') returning id into f;

  -- THE DECISION, IN ONE ASSERTION: the newer run went quiet about it, and it is still open.
  update public.audit_findings set not_raised_by_run_id = r2 where id = f;
  select count(*) into n from public.audit_findings
   where id = f and status = 'open' and closed_reason is null and closed_by_run_id is null;
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: a finding the newer audit did not raise must stay OPEN with no close recorded.';
  end if;

  -- A person's close: the person, the date, and a reason in their own column's words.
  update public.audit_findings
     set status = 'closed', closed_at = now(), closed_reason = 'closed by a person'
   where id = f;
  select count(*) into n from public.audit_findings
   where id = f and status = 'closed' and closed_at is not null and closed_by_run_id is null;
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: a person close did not record its date, or picked up a run id.';
  end if;

  -- REOPEN puts it back, with no trace of a close left on the row.
  update public.audit_findings
     set status = 'open', closed_at = null, closed_by = null, closed_reason = null
   where id = f;
  select count(*) into n from public.audit_findings
   where id = f and status = 'open' and closed_at is null and closed_reason is null;
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: a reopened finding still carries a close.';
  end if;

  -- And deleting the newer run leaves the finding alone, with the pointer cleared.
  update public.audit_findings set not_raised_by_run_id = r2 where id = f;
  delete from public.audit_runs where id = r2;
  select count(*) into n from public.audit_findings where id = f and not_raised_by_run_id is null;
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: deleting the newer run did not leave the finding with a cleared pointer.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 082 VERIFIED: not_raised_by_run_id, closed_by and closed_at exist; both keys SET NULL; a finding the newer audit did not raise stays OPEN with no close recorded; a person close records its date and no run; Reopen leaves no trace; and deleting the newer run clears the pointer without touching the finding.';
end $$;

commit;
