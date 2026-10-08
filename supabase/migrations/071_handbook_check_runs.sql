-- ===========================================================================
-- 071 — WHAT A HANDBOOK CHECK NEEDS TO RUN (HR Step 8, part 1; the owner accepted G1–G7)
-- ===========================================================================
-- WHY. Migration 066 made the check's four tables before the check existed. Designing the check (Step 8's
-- read-only part) found seven things they cannot yet hold, and the owner accepted all seven:
--
--   G1  a failed piece says why — `failed_reason`, required exactly when a row has failed or been cancelled,
--       as audit_sections requires `could_not_complete_reason` (058).
--   G2  how many times a piece was started — `attempts`. Audits recovers a crashed section with no limit,
--       so a section that crashes every time is paid for every fifteen minutes. A handbook piece is retried
--       once, then failed (the owner).
--   G3  each piece's receipt — `started_at`, `model`, `prompt_sha256`, `ai_call_id`, as audit_sections (058).
--       Rows checked in the same call share one ai_call_id, which is how a packed piece can be read back.
--   G4  the email's guard — `handbook_checks.notified_at`, set only after a send succeeds (as audit_runs).
--   G5  one open check per handbook — a unique index over a handbook's queued or checking checks. Two presses
--       in two tabs both get past a lookup; only the database can refuse the second.
--   G6  what the check was checked against — `handbook_checks.context_sha256`, the company context's
--       fingerprint, so a later reuse of findings can tell whether the company has changed.
--   G7  the first check of a brand-new handbook — reason 'new_handbook' (the owner's word).
--
-- AND ONE MORE, BECAUSE THE OWNER'S RULE NEEDS IT: status 'cancelled', on checks and on their rows. "A newer
-- version added mid-check cancels the old version's queued pieces." Writing that as 'failed' would describe
-- a piece nobody tried as one that went wrong, and "a check whose pieces all failed is 'failed'" would then
-- say the same of a check nobody needs.
--
-- WHO MAY DO WHAT: unchanged. A person reads these tables and writes none of them (066 grants SELECT only on
-- handbook_checks and handbook_check_sections); the server writes them. Table grants cover new columns; the
-- verify block reads that back.
--
-- THE VERIFY BLOCK PROVES EVERY RULE ON PROBE ROWS OF ITS OWN (the owner, after 070, DECISIONS.md §171), so it
-- tests the same things on production's empty tables as on staging's. The probe is removed before it ends.
-- Constraint names below were read from staging's catalog (pg_constraint), not from 066's text.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- handbook_checks: G4, G6, G7, and 'cancelled'
-- ---------------------------------------------------------------------------
alter table public.handbook_checks add column if not exists notified_at    timestamptz;
alter table public.handbook_checks add column if not exists context_sha256 text;

alter table public.handbook_checks drop constraint if exists handbook_checks_reason_check;
alter table public.handbook_checks add constraint handbook_checks_reason_check
  check (reason in ('new_handbook', 'new_version', 'scheduled', 'on_demand'));

alter table public.handbook_checks drop constraint if exists handbook_checks_status_check;
alter table public.handbook_checks add constraint handbook_checks_status_check
  check (status in ('queued', 'checking', 'done', 'failed', 'cancelled'));

-- G5: one queued-or-checking check per handbook, refused by the database.
create unique index if not exists idx_handbook_checks_one_open
  on public.handbook_checks (handbook_id) where status in ('queued', 'checking');

-- ---------------------------------------------------------------------------
-- handbook_check_sections: G1, G2, G3, and 'cancelled'
-- ---------------------------------------------------------------------------
alter table public.handbook_check_sections add column if not exists failed_reason text;
alter table public.handbook_check_sections add column if not exists attempts      integer not null default 0;
alter table public.handbook_check_sections add column if not exists started_at    timestamptz;
alter table public.handbook_check_sections add column if not exists model         text;
alter table public.handbook_check_sections add column if not exists prompt_sha256 text;
alter table public.handbook_check_sections add column if not exists ai_call_id    uuid references public.ai_calls (id) on delete set null;

alter table public.handbook_check_sections drop constraint if exists handbook_check_sections_status_check;
alter table public.handbook_check_sections add constraint handbook_check_sections_status_check
  check (status in ('queued', 'checking', 'done', 'failed', 'cancelled'));

alter table public.handbook_check_sections drop constraint if exists handbook_check_sections_attempts_not_negative;
alter table public.handbook_check_sections add constraint handbook_check_sections_attempts_not_negative
  check (attempts >= 0);

-- G1: a reason exactly when the row failed or was cancelled — never a failure without one, never a stale one.
alter table public.handbook_check_sections drop constraint if exists handbook_check_sections_failed_says_why;
alter table public.handbook_check_sections add constraint handbook_check_sections_failed_says_why check (
  (status in ('failed', 'cancelled') and failed_reason is not null)
  or (status not in ('failed', 'cancelled') and failed_reason is null)
);

comment on column public.handbook_check_sections.attempts is
  'How many times this row was started. A failed or crashed piece is put back once, then failed (HR Step 8).';
comment on column public.handbook_check_sections.ai_call_id is
  'The ledger row of the call that checked this row. Rows packed into one call share it.';
comment on column public.handbook_checks.context_sha256 is
  'Fingerprint of the company context the check was given (lib/companyContext.ts sha256).';

-- ===========================================================================
-- VERIFY. Raises unless every line holds; read back, never taken from the statements above.
-- ===========================================================================
do $$
declare
  n int; c text; refused boolean;
  co uuid; hb uuid; sec uuid; ck1 uuid; ck2 uuid; row1 uuid;
begin
  -- the columns, with their types
  select count(*) into n from information_schema.columns where table_schema = 'public' and (
       (table_name = 'handbook_checks' and column_name = 'notified_at' and data_type = 'timestamp with time zone')
    or (table_name = 'handbook_checks' and column_name = 'context_sha256' and data_type = 'text')
    or (table_name = 'handbook_check_sections' and column_name = 'failed_reason' and data_type = 'text')
    or (table_name = 'handbook_check_sections' and column_name = 'attempts' and data_type = 'integer' and is_nullable = 'NO')
    or (table_name = 'handbook_check_sections' and column_name = 'started_at' and data_type = 'timestamp with time zone')
    or (table_name = 'handbook_check_sections' and column_name = 'model' and data_type = 'text')
    or (table_name = 'handbook_check_sections' and column_name = 'prompt_sha256' and data_type = 'text')
    or (table_name = 'handbook_check_sections' and column_name = 'ai_call_id' and data_type = 'uuid'));
  if n <> 8 then
    raise exception 'MIGRATION 071 FAILED: expected 8 new columns with their types, found %.', n;
  end if;

  -- a person reads the new columns and writes none; anon nothing
  for c in select unnest(array['failed_reason', 'attempts', 'started_at', 'model', 'prompt_sha256', 'ai_call_id']) loop
    if not has_column_privilege('authenticated', 'public.handbook_check_sections', c, 'SELECT') then
      raise exception 'MIGRATION 071 FAILED: authenticated cannot read handbook_check_sections.%.', c;
    end if;
    if has_column_privilege('authenticated', 'public.handbook_check_sections', c, 'UPDATE')
       or has_column_privilege('authenticated', 'public.handbook_check_sections', c, 'INSERT')
       or has_column_privilege('anon', 'public.handbook_check_sections', c, 'SELECT') then
      raise exception 'MIGRATION 071 FAILED: handbook_check_sections.% is writable by a person or readable by anon.', c;
    end if;
  end loop;
  for c in select unnest(array['notified_at', 'context_sha256']) loop
    if not has_column_privilege('authenticated', 'public.handbook_checks', c, 'SELECT')
       or has_column_privilege('authenticated', 'public.handbook_checks', c, 'UPDATE')
       or has_column_privilege('anon', 'public.handbook_checks', c, 'SELECT') then
      raise exception 'MIGRATION 071 FAILED: handbook_checks.% does not read back as read-only to a person, nothing to anon.', c;
    end if;
  end loop;
  -- ...and that check can see a presence: the same question about `status`, a column 066 covers
  if not has_column_privilege('authenticated', 'public.handbook_check_sections', 'status', 'SELECT') then
    raise exception 'MIGRATION 071 FAILED: the privilege check sees nothing on handbook_check_sections.status either.';
  end if;

  -- ---- THE RULES, ON PROBE ROWS OF THEIR OWN ----
  insert into public.companies (name, industry, state) values ('Migration 071 probe', 'chemical manufacturing', 'OR')
    returning id into co;
  insert into public.handbooks (company_id, name, file_path, file_name, status)
    values (co, 'Migration 071 probe', co || '/handbooks/probe-071.pdf', 'probe-071.pdf', 'read') returning id into hb;
  insert into public.handbook_sections (handbook_id, company_id, position, title, text, text_sha256)
    values (hb, co, 0, 'Probe', 'probe text', 'probe') returning id into sec;

  -- G7: 'new_handbook' is accepted and reads back (a presence), and an unknown reason is refused
  insert into public.handbook_checks (handbook_id, company_id, reason) values (hb, co, 'new_handbook') returning id into ck1;
  select count(*) into n from public.handbook_checks where id = ck1 and reason = 'new_handbook' and status = 'queued';
  if n <> 1 then raise exception 'MIGRATION 071 FAILED: a new_handbook check did not save on the probe.'; end if;
  refused := false;
  begin
    insert into public.handbook_checks (handbook_id, company_id, reason, status) values (hb, co, 'whenever', 'done');
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'MIGRATION 071 FAILED: reason "whenever" was accepted.'; end if;

  -- G5: a second open check of the same handbook is refused, queued or checking
  refused := false;
  begin
    insert into public.handbook_checks (handbook_id, company_id, reason) values (hb, co, 'on_demand');
  exception when unique_violation then refused := true;
  end;
  if not refused then raise exception 'MIGRATION 071 FAILED: a second queued check of one handbook was accepted.'; end if;
  update public.handbook_checks set status = 'checking' where id = ck1;
  refused := false;
  begin
    insert into public.handbook_checks (handbook_id, company_id, reason) values (hb, co, 'on_demand');
  exception when unique_violation then refused := true;
  end;
  if not refused then raise exception 'MIGRATION 071 FAILED: a queued check beside a checking one was accepted.'; end if;
  -- ...and once the first is done, the next is accepted: the rule refuses OPEN checks only
  update public.handbook_checks set status = 'done', finished_at = now() where id = ck1;
  insert into public.handbook_checks (handbook_id, company_id, reason) values (hb, co, 'on_demand') returning id into ck2;
  -- 'cancelled' is a check status
  update public.handbook_checks set status = 'cancelled' where id = ck2;
  select count(*) into n from public.handbook_checks where id = ck2 and status = 'cancelled';
  if n <> 1 then raise exception 'MIGRATION 071 FAILED: a check could not be cancelled.'; end if;

  -- G1 and G2 on a probe row: attempts start at 0
  insert into public.handbook_check_sections (check_id, company_id, kind, section_id) values (ck1, co, 'section', sec)
    returning id into row1;
  select count(*) into n from public.handbook_check_sections where id = row1 and attempts = 0 and failed_reason is null;
  if n <> 1 then raise exception 'MIGRATION 071 FAILED: a new row does not start at 0 attempts with no reason.'; end if;

  -- a failure WITH its reason is accepted (a presence), and the same for a cancellation
  update public.handbook_check_sections set status = 'failed', failed_reason = 'probe: the model did not answer' where id = row1;
  update public.handbook_check_sections set status = 'cancelled', failed_reason = 'probe: a newer version was added' where id = row1;
  select count(*) into n from public.handbook_check_sections where id = row1 and status = 'cancelled';
  if n <> 1 then raise exception 'MIGRATION 071 FAILED: a cancelled row with its reason did not save.'; end if;

  refused := false;
  begin
    update public.handbook_check_sections set status = 'failed', failed_reason = null where id = row1;
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'MIGRATION 071 FAILED: a failed row with no reason was accepted.'; end if;

  refused := false;
  begin
    update public.handbook_check_sections set status = 'done', failed_reason = 'left over' where id = row1;
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'MIGRATION 071 FAILED: a done row carrying a failure reason was accepted.'; end if;

  refused := false;
  begin
    update public.handbook_check_sections set attempts = -1 where id = row1;
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'MIGRATION 071 FAILED: a negative attempts count was accepted.'; end if;

  refused := false;
  begin
    update public.handbook_check_sections set status = 'stalled', failed_reason = null where id = row1;
  exception when check_violation then refused := true;
  end;
  if not refused then raise exception 'MIGRATION 071 FAILED: an unknown row status was accepted.'; end if;

  -- the probe goes (everything hangs off its company, ON DELETE CASCADE), and nothing of it remains
  delete from public.companies where id = co;
  select (select count(*) from public.handbooks where id = hb) + (select count(*) from public.handbook_checks where company_id = co)
       + (select count(*) from public.handbook_check_sections where company_id = co) into n;
  if n <> 0 then raise exception 'MIGRATION 071 FAILED: % probe row(s) were not removed.', n; end if;

  raise notice 'MIGRATION 071 VERIFIED: 8 new columns, read-only to a person and nothing to anon; on probe rows of its own: new_handbook accepted and "whenever" refused; a second open check refused (queued, and beside checking) and accepted once the first was done; cancelled accepted on a check and a row; a row starts at 0 attempts; failed and cancelled need a reason, a done row may not carry one; -1 attempts and an unknown status refused; the probe removed.';
end $$;

commit;
