-- ===========================================================================
-- 070 — HOW FAR A HANDBOOK'S READING HAS GOT (HR Step 6c)
-- ===========================================================================
-- WHY. A question about a handbook too long to send whole has to wait until the handbook's sections are
-- found, so the right ones can be chosen. The answer route waits inside the request and tells the person how
-- far the reading has got — "<done> of <total> parts done" — which only the reader knows. So the reader
-- writes its progress, part by part, onto the handbook's row, and the route reads it back.
--
-- WHY NOT AN EXISTING COLUMN. `status_reason` is the person's words, and migration 066 requires it whenever a
-- handbook could not be read (`handbooks_could_not_read_says_why`); counts in it would reach the screen.
-- `updated_at` moves on every write and says nothing about how many parts are done.
--
-- WHAT IT ADDS. Two nullable integers on `handbooks`, written by `lib/handbookRead.ts` under the reading's
-- claim and cleared when a new reading is claimed: `outline_parts_total` (how many parts the PDF's text is
-- outlined in) and `outline_parts_done`. NULL means no outline is under way (a Word file, or nothing read yet).
-- A person already may update their own handbook rows (066); table grants cover new columns, and the verify
-- block reads that back. The CHECK is tested by violating it, on a probe row the block makes and removes itself
-- (rewritten after staging ran the first version, which skipped the test on an empty table: DECISIONS.md §171).
-- ===========================================================================

begin;

alter table public.handbooks add column if not exists outline_parts_total integer;
alter table public.handbooks add column if not exists outline_parts_done  integer;

alter table public.handbooks drop constraint if exists handbooks_outline_progress_in_range;
alter table public.handbooks add constraint handbooks_outline_progress_in_range check (
  coalesce(outline_parts_total, 0) >= 0
  and coalesce(outline_parts_done, 0) >= 0
  and (outline_parts_done is null or outline_parts_total is null or outline_parts_done <= outline_parts_total)
);

-- ===========================================================================
-- VERIFY. Raises unless every line holds; read back, never taken from the statements above.
-- ===========================================================================
do $$
declare n int; c text; co uuid; hb uuid; refused boolean;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'handbooks'
     and column_name in ('outline_parts_total', 'outline_parts_done') and data_type = 'integer' and is_nullable = 'YES';
  if n <> 2 then
    raise exception 'MIGRATION 070 FAILED: expected 2 nullable integer progress columns on handbooks, found %.', n;
  end if;

  -- A person may read and update them exactly as the rest of the row (066: select, insert, update, delete).
  for c in select unnest(array['outline_parts_total', 'outline_parts_done']) loop
    if not has_column_privilege('authenticated', 'public.handbooks', c, 'SELECT')
       or not has_column_privilege('authenticated', 'public.handbooks', c, 'UPDATE') then
      raise exception 'MIGRATION 070 FAILED: authenticated cannot read or update handbooks.%.', c;
    end if;
    if has_column_privilege('anon', 'public.handbooks', c, 'SELECT') then
      raise exception 'MIGRATION 070 FAILED: anon can read handbooks.%.', c;
    end if;
  end loop;
  -- ...and that check can see a presence: the same question about `status`, a column 066 covers.
  if not has_column_privilege('authenticated', 'public.handbooks', 'status', 'UPDATE') then
    raise exception 'MIGRATION 070 FAILED: the privilege check sees nothing on handbooks.status either.';
  end if;

  -- EVERY EXISTING ROW IS NULL — checked first, before the probe below writes progress onto its own row.
  select count(*) into n from public.handbooks where outline_parts_total is not null or outline_parts_done is not null;
  if n <> 0 then
    raise exception 'MIGRATION 070 FAILED: % handbook(s) already carry progress.', n;
  end if;

  -- THE CHECK, BY VIOLATING IT, ON A PROBE ROW OF ITS OWN. *** Rewritten 7 October 2026, after 070 was applied to
  -- staging (DECISIONS.md §171). *** The first version tested the rule on whatever row the table held and SKIPPED
  -- the test when it held none — and production's handbooks table is empty until HR is released, so there the
  -- block would have passed without testing anything, then printed "3 of 2 refused". A probe company and handbook,
  -- as migration 066's block made them, prove it on any database; they are removed before the block ends.
  insert into public.companies (name, industry, state) values ('Migration 070 probe', 'chemical manufacturing', 'OR')
    returning id into co;
  insert into public.handbooks (company_id, name, file_path, file_name)
    values (co, 'Migration 070 probe', co || '/handbooks/probe-070.pdf', 'probe-070.pdf') returning id into hb;

  -- the rule can see a presence: 2 of 2, a real state, is accepted and reads back
  update public.handbooks set outline_parts_total = 2, outline_parts_done = 2 where id = hb;
  select count(*) into n from public.handbooks where id = hb and outline_parts_total = 2 and outline_parts_done = 2;
  if n <> 1 then
    raise exception 'MIGRATION 070 FAILED: 2 of 2 parts done did not save on the probe, so the refusals below would prove nothing.';
  end if;

  refused := false;
  begin
    update public.handbooks set outline_parts_total = 2, outline_parts_done = 3 where id = hb;
  exception when check_violation then refused := true;
  end;
  if not refused then
    raise exception 'MIGRATION 070 FAILED: 3 of 2 parts done was accepted.';
  end if;

  refused := false;
  begin
    update public.handbooks set outline_parts_total = -1, outline_parts_done = null where id = hb;
  exception when check_violation then refused := true;
  end;
  if not refused then
    raise exception 'MIGRATION 070 FAILED: a negative number of parts was accepted.';
  end if;

  -- the probe goes (its handbook with its company, ON DELETE CASCADE), and nothing of it remains
  delete from public.companies where id = co;
  select count(*) into n from public.handbooks where id = hb;
  if n <> 0 then
    raise exception 'MIGRATION 070 FAILED: the probe handbook was not removed.';
  end if;

  raise notice 'MIGRATION 070 VERIFIED: handbooks.outline_parts_total and outline_parts_done, nullable integers; authenticated read and update as the rest of the row, anon nothing; every existing row NULL; on a probe row of its own, 2 of 2 saved, 3 of 2 and -1 refused; the probe removed.';
end $$;

commit;
