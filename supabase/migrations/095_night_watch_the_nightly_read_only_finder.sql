-- 095 — NIGHT WATCH: ONE ROW A DAY SAYING WHAT THE PRODUCT DID TO ITSELF.
--
-- The owner's decision 75 of 4 November 2026 (`docs/GAPS-PLAN.md` §3): **code finds, a report
-- lands each morning, a person decides. It never calls a model and it never changes anything.**
--
-- The week of 3–5 November was spent finding, by hand and after the fact, eleven kinds of thing
-- that a query could have found overnight. Every one of them cost something while it was open:
--
--   W2  three paid readings refused by a CHECK the code did not hold against, $0.4430, and the
--       stored row said the model had never been called
--   W3  a double press bought a second identical audit, $0.4924
--   W5  six of ten audit lines wrote a bare document handle at the person
--   W1  nine files read in silence for eleven minutes
--
-- None of those was found by a test. All four were found by a person reading rows days later. This
-- table is where the reading happens by itself, at 05:30 Pacific, for free.
--
-- ===========================================================================
-- WHY IT CARRIES `company_id`, AND WHY THAT COLUMN IS THE WHOLE POINT
-- ===========================================================================
--
-- The report is naturally cross-company: it counts across the estate. The first shape written for
-- it was `(date, counts, rows)` with no tenant column at all — and that shape is a breach waiting
-- to happen, for a reason that has nothing to do with RLS:
--
--   `scripts/check-schema-contracts.js` CHECK 2 forces every table carrying `company_id` into
--   `/api/account` DELETE's list or into its exemption list with a written reason. **It keys on
--   the COLUMN.** A table holding row ids from every company and no `company_id` is invisible to
--   it — so deleting a company would leave its row ids sitting in a jsonb blob, and nothing in
--   the build could say so.
--
-- So: **one row per company per day, plus one `company_id = null` row holding the estate totals
-- and NO row ids.** Check 2 now sees the column and demands the decision; `/api/account` DELETE
-- names the table and clears it with the same filter as everything else; and the totals row,
-- which is the only row that spans companies, holds nothing that points at anybody.
--
-- `unique nulls not distinct (date, company_id)` — plain UNIQUE treats two NULLs as distinct, so
-- without `nulls not distinct` a second totals row for the same day would be accepted and the
-- page would show the day twice. Postgres 15+; this database is 17.6, read with `version()`.
--
-- ===========================================================================
-- AND NOBODY IS GRANTED ANYTHING ON IT
-- ===========================================================================
--
-- Decision 75's gate: the page is the owner's. `CLAUDE.md` §3.6 says RLS is the security
-- boundary, and the hardest boundary available is **no grant at all** — a policy can be widened
-- by a later migration that means well; an absent grant cannot. So `anon` and `authenticated` are
-- REVOKEd (both roles, §3.6's shape: `supabase_admin`'s defaults on public still grant both
-- everything for objects IT creates, and a redundant revoke costs nothing) and then granted
-- NOTHING. There is no policy on this table because there is no role that can reach it.
--
-- The one reader is `app/api/quality/route.ts`, which checks the signed-in address against
-- QUALITY_EMAIL, answers 404 on any mismatch (§3.6, 404-not-403: a stranger must not learn the
-- page exists), and then makes one named service-role SELECT with its reason at the line.
--
-- RLS is still ENABLED, with no policy. Belt and braces: if a future migration grants a right by
-- accident, enabled-RLS-with-no-policy denies every row anyway.
--
-- ===========================================================================
-- §3.7: AND `job_runs_job_check` IS RESTATED WHOLE, BECAUSE 'quality' IS NOT IN IT
-- ===========================================================================
--
-- Read back from `pg_constraint` on staging before writing this, not taken from a migration file:
--
--   job_runs_job_check  CHECK ((job = ANY (ARRAY['summarise','delete','account_delete',
--                        'scan_documents','audit_sections','handbook_checks','calendar_month'])))
--
-- `startJobRun` would have inserted `job = 'quality'` and the database would have refused it —
-- **which is W2's exact shape**: a field the code did not hold against a list the database does.
-- Found by reading the catalog during the map, before a line of the job was written. There is no
-- `alter … add value` for a CHECK, so it is dropped and added, and the new definition is the whole
-- list so the next person reads one statement instead of two.
--
-- Nothing is backfilled and nothing is stranded: widening a CHECK accepts every row already
-- stored.

begin;

create table if not exists public.quality_reports (
  id          uuid primary key default gen_random_uuid(),
  "date"      date not null,
  -- NULL means "the whole estate": the totals row, which holds no row ids. A set value is one
  -- company's own day, and is what /api/account DELETE clears.
  company_id  uuid references public.companies(id) on delete cascade,
  counts      jsonb not null default '{}'::jsonb,
  "rows"      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint quality_reports_day_company_key unique nulls not distinct ("date", company_id),
  -- The totals row spans companies, so it must not carry ids. Enforced rather than remembered:
  -- a CHECK is the only thing that survives somebody editing the writer.
  constraint quality_reports_totals_hold_no_ids
    check (company_id is not null or "rows" = '{}'::jsonb)
);

create index if not exists idx_quality_reports_date_company
  on public.quality_reports ("date" desc, company_id);

comment on table public.quality_reports is
  'Night Watch (decision 75): one row per company per day plus one company_id = null totals row, '
  'written by /api/jobs/quality at 05:30 Pacific. Read-only counts over the previous Pacific day. '
  'Nobody is granted anything on this table; app/api/quality/route.ts reads it as the service '
  'role after checking the caller against QUALITY_EMAIL.';
comment on column public.quality_reports."date" is
  'The Pacific day the counts describe, not the day the job ran. The job runs at 05:30 Pacific '
  'and reads the day before, so this is always yesterday at write time.';
comment on column public.quality_reports.company_id is
  'One company, or NULL for the estate totals row — which carries no row ids (see the CHECK).';
comment on column public.quality_reports."rows" is
  'The ids behind each count, so a person can open them. Empty on the totals row.';

alter table public.quality_reports enable row level security;

-- §3.6's shape: REVOKE from both roles, then grant. Here the grant is nothing.
revoke all on table public.quality_reports from anon;
revoke all on table public.quality_reports from authenticated;

-- ---- §3.7 / S-1: 'quality' is not in job_runs_job_check, so the whole list is restated ----
alter table public.job_runs
  drop constraint if exists job_runs_job_check;
alter table public.job_runs
  add constraint job_runs_job_check check (
    job in ('summarise', 'delete', 'account_delete', 'scan_documents',
            'audit_sections', 'handbook_checks', 'calendar_month', 'quality')
  );

comment on column public.job_runs.job is
  'Which job wrote this row, one of eight: summarise · delete · account_delete · scan_documents '
  '· audit_sections · handbook_checks · calendar_month · quality (Night Watch, decision 75).';

-- ===========================================================================
-- THE PROBE. §3.7: a constraint nobody has tried to break is a comment.
-- ===========================================================================
-- *** THE PROBE MAKES ITS OWN COMPANY — 5 November 2026, before the production run, and this is
-- the last of the four files to be put right. *** This block used to open with `select id into co
-- from public.companies limit 1`, borrowing whichever company the planner handed back: a fixture
-- on staging, **a real customer on production**.
--
-- *** THIS PROBE MOVED NO COUNTER, AND IT WAS STILL THE WRONG SHAPE. *** Read from `pg_trigger` on
-- staging: `quality_reports` and `job_runs` carry **no trigger at all**, and the only four triggers
-- that call `bump_usage_counter_for` sit on `document_scans`, `audit_runs` and `checklists`. So
-- unlike 093 — whose probe scan fired `document_scans_count_reading` and added one to a borrowed
-- company's `files_read` with no AFTER DELETE trigger to take it back — nothing here reached a
-- customer's Dashboard. The change is made anyway, because 091, 093 and 094 all now carry their own
-- probe company and a lone survivor of the old pattern is the one that gets copied next.
--
-- *** AND THE TEARDOWN IS NOT SYMMETRICAL, WHICH IS THE WHOLE REASON TO WRITE IT OUT. ***
-- Read from `pg_constraint` on staging:
--
--   quality_reports_company_id_fkey  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
--
-- So the row written **for the probe company** leaves with the company, by that cascade — which is
-- also a free proof of the claim `/api/account` DELETE makes about this table. **But the estate
-- totals row carries `company_id = null`**, which is the point of the table's shape, and a NULL
-- references nothing: no cascade can ever reach it. **It has to be deleted explicitly**, and the
-- delete below is scoped to `"date" = '1999-01-01' and company_id is null` rather than to the date
-- alone, so it can never take a row that belongs to somebody.
do $$
declare
  co uuid; ok boolean; n int; jobs_before int;
begin
  select count(*) into jobs_before from public.job_runs;
  insert into public.companies (name) values ('095 probe company') returning id into co;

    -- 1. a company's day, and the estate totals row, both go in for the same date
    insert into public.quality_reports ("date", company_id, counts, "rows")
      values ('1999-01-01', co, '{"answers_no_source": 1}'::jsonb, '{"answers_no_source": ["x"]}'::jsonb);
    insert into public.quality_reports ("date", company_id, counts, "rows")
      values ('1999-01-01', null, '{"answers_no_source": 1}'::jsonb, '{}'::jsonb);

    -- 2. a SECOND totals row for the same day is refused. Plain UNIQUE would have accepted it,
    --    because two NULLs are distinct — which is the whole reason for `nulls not distinct`.
    ok := false;
    begin
      insert into public.quality_reports ("date", company_id, counts)
        values ('1999-01-01', null, '{}'::jsonb);
    exception when unique_violation then ok := true;
    end;
    if not ok then
      raise exception 'MIGRATION 095 FAILED: a second totals row for one day was accepted. '
        'unique nulls not distinct is not doing its job.';
    end if;

    -- 3. a second row for the same company and day is refused too
    ok := false;
    begin
      insert into public.quality_reports ("date", company_id, counts)
        values ('1999-01-01', co, '{}'::jsonb);
    exception when unique_violation then ok := true;
    end;
    if not ok then
      raise exception 'MIGRATION 095 FAILED: a company got two rows for one day.';
    end if;

    -- 4. ⚡ A TOTALS ROW CARRYING ROW IDS IS REFUSED. The report spans companies; the row that
    --    spans them must not point at anybody.
    ok := false;
    begin
      insert into public.quality_reports ("date", company_id, counts, "rows")
        values ('1999-01-02', null, '{}'::jsonb, '{"answers_no_source": ["x"]}'::jsonb);
    exception when check_violation then ok := true;
    end;
    if not ok then
      raise exception 'MIGRATION 095 FAILED: the totals row accepted row ids.';
    end if;

    -- ---- TEARDOWN, THE ASYMMETRIC HALF FIRST. ----
    -- The TOTALS row has `company_id = null` and therefore no cascade can reach it: it goes by
    -- hand, scoped to the date AND to `company_id is null` so it cannot take anybody's row. The
    -- 1999-01-02 totals row was REFUSED by the ids CHECK at step 4 and never existed, so there is
    -- nothing to delete for that date — the old blanket `where "date" in (…)` claimed to clear a
    -- row that the probe had just proved impossible.
    delete from public.quality_reports where "date" = '1999-01-01' and company_id is null;
    select count(*) into n from public.quality_reports where "date" = '1999-01-01' and company_id is null;
    if n <> 0 then
      raise exception 'MIGRATION 095 FAILED: the totals probe row did not clear.';
    end if;

    -- The COMPANY's row is deliberately NOT deleted here. Dropping the probe company below must
    -- take it, by quality_reports_company_id_fkey ON DELETE CASCADE, and that is checked after.
    select count(*) into n from public.quality_reports where company_id = co;
    if n <> 1 then
      raise exception 'MIGRATION 095 FAILED: expected exactly 1 row still standing for the probe '
        'company before the cascade, found %.', n;
    end if;

    delete from public.companies where id = co;

    select count(*) into n from public.quality_reports where company_id = co;
    if n <> 0 then
      raise exception 'MIGRATION 095 FAILED: % quality_reports row(s) outlived the probe company, '
        'so quality_reports_company_id_fkey is not cascading.', n;
    end if;
    select count(*) into n from public.quality_reports where "date" = '1999-01-01';
    if n <> 0 then
      raise exception 'MIGRATION 095 FAILED: % probe row(s) dated 1999-01-01 are still there.', n;
    end if;
    select count(*) into n from public.usage_counters where company_id = co;
    if n <> 0 then
      raise exception 'MIGRATION 095 FAILED: the probe company kept a usage_counters row.';
    end if;

    raise notice 'MIGRATION 095: a company day and a totals row in; a duplicate of each refused; '
      'a totals row with ids refused; the totals row deleted by hand and the company row taken by '
      'the cascade.';

  -- 5. ⚡ ALL EIGHT JOB WORDS GO IN, AND A NINTH IS REFUSED.
  --
  -- *** THE PROBE ROWS ARE MARKED AND DELETED BY THEIR MARK, NEVER BY "looks recent". ***
  -- `scan_documents` and `audit_sections` run every five minutes and OPEN their job_runs row
  -- before doing any work, so a cleanup of the shape `where counts is null and started_at >
  -- now() - interval '1 minute'` would delete a real sweep's open row mid-run. The marker is in
  -- `counts`, which is the one column nothing else writes at insert time.
  insert into public.job_runs (job, counts) values
    ('quality',        '{"migration_095_probe": true}'::jsonb),
    ('summarise',      '{"migration_095_probe": true}'::jsonb),
    ('delete',         '{"migration_095_probe": true}'::jsonb),
    ('account_delete', '{"migration_095_probe": true}'::jsonb),
    ('scan_documents', '{"migration_095_probe": true}'::jsonb),
    ('audit_sections', '{"migration_095_probe": true}'::jsonb),
    ('handbook_checks','{"migration_095_probe": true}'::jsonb),
    ('calendar_month', '{"migration_095_probe": true}'::jsonb);

  ok := false;
  begin
    insert into public.job_runs (job, counts)
      values ('night_watch', '{"migration_095_probe": true}'::jsonb);
  exception when check_violation then ok := true;
  end;
  if not ok then
    raise exception 'MIGRATION 095 FAILED: job_runs accepted a job outside the eight.';
  end if;

  delete from public.job_runs where counts ? 'migration_095_probe';
  select count(*) into n from public.job_runs where counts ? 'migration_095_probe';
  if n <> 0 then
    raise exception 'MIGRATION 095 FAILED: the job_runs probe rows did not clear.';
  end if;

  -- *** AND IT TOOK NOTHING ELSE WITH THEM. *** Counting the marked rows to zero proves the delete
  -- reached its own rows; it does not prove it stopped there. The table must be exactly the size it
  -- was before this block ran — which is the check that would catch a mark that matched a real
  -- sweep's row, and is why the mark lives in `counts` and not in a time window.
  select count(*) into n from public.job_runs;
  if n <> jobs_before then
    raise exception 'MIGRATION 095 FAILED: job_runs held % rows before the probe and % after; the '
      'probe cleanup took % row(s) that were not its own.', jobs_before, n, jobs_before - n;
  end if;
  raise notice 'MIGRATION 095: all eight job words accepted, a ninth refused, probe rows cleared, '
    'and job_runs is back to its % rows.', jobs_before;
end $$;

-- ===========================================================================
-- THE GRANTS, READ BACK RATHER THAN TRUSTED — all eight rights, both roles.
--
-- `information_schema.role_table_grants` is BLIND from the Supabase CLI: it connects as
-- `supabase_read_only_user` and sees no rows at all (`docs/HR-MACHINERY.md` B12). So the only
-- honest verification is `has_table_privilege`, one right at a time, as 066–068 do. And a grant
-- list says what was ADDED, not what a role HOLDS (`CLAUDE.md` §3.6).
-- ===========================================================================
do $$
declare bad text;
begin
  select string_agg(format('%s %s', r.rolname, p.priv), '; ') into bad
    from (values ('anon'), ('authenticated')) as r(rolname)
   cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                      ('TRUNCATE'), ('TRIGGER'), ('REFERENCES'), ('MAINTAIN')) as p(priv)
   where has_table_privilege(r.rolname, 'public.quality_reports', p.priv);
  if bad is not null then
    raise exception 'MIGRATION 095 FAILED: a person holds a right on quality_reports: %', bad;
  end if;

  -- ...and service_role can still reach it, or the job and the page cannot run. An absence that
  -- cannot see a presence is not a check (`CLAUDE.md` §9a).
  if not (has_table_privilege('service_role', 'public.quality_reports', 'SELECT')
      and has_table_privilege('service_role', 'public.quality_reports', 'INSERT')
      and has_table_privilege('service_role', 'public.quality_reports', 'UPDATE')) then
    raise exception 'MIGRATION 095 FAILED: service_role cannot read or write quality_reports, '
      'so the job and the page would both fail.';
  end if;

  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = 'quality_reports' and c.relrowsecurity) then
    raise exception 'MIGRATION 095 FAILED: row level security is not enabled on quality_reports.';
  end if;

  raise notice 'MIGRATION 095: anon and authenticated hold none of the eight rights on '
    'quality_reports; service_role reads and writes it; RLS is on with no policy.';
end $$;

-- The job constraint, read back out of the catalog rather than trusted from above.
do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
   where conrelid = 'public.job_runs'::regclass and conname = 'job_runs_job_check';
  if def is null then
    raise exception 'MIGRATION 095 FAILED: job_runs_job_check is gone.';
  end if;
  if def not like '%quality%' then
    raise exception 'MIGRATION 095 FAILED: the constraint does not name quality: %', def;
  end if;
  raise notice 'MIGRATION 095: job_runs_job_check is now %', def;
end $$;

commit;
