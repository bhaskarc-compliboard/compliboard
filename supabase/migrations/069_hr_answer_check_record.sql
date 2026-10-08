-- ===========================================================================
-- 069 — THE CHECK RECORD ON AN HR ANSWER (HR Step 6b; DECISIONS.md §169, follow-up 1)
-- ===========================================================================
-- WHY. An HR answer's quotes and links are checked in code when it finishes (`lib/hrAnswer.ts`), and the
-- owner's Opus run on 7 October showed what cannot be re-checked afterwards: which handbooks the answer was
-- given, which pages its search returned, its cited passages, and whether each handbook card came from a
-- [H…] marker or a plain quote. So each new HR answer stores a small record of that check beside its turn,
-- and an answer can be audited after the fact.
--
-- WHERE, AND WHY HERE. One nullable jsonb column on `turns`, written only by `app/api/hr/answer` when it
-- saves an assistant turn. Every workspace turn stays NULL, and nothing the workspace reads changes:
-- `lib/conversation.ts` loadTurns names its columns and does not name this one. A separate table would need
-- its own grants, policies, company column and account-delete line for one value per answer turn.
--
-- WHO MAY DO WHAT: exactly what they may do with the rest of the row. Migration 031 grants `authenticated`
-- SELECT and INSERT on turns and deliberately no UPDATE (a transcript is not rewritten); table grants cover
-- a new column, and the verify block reads that back rather than assuming it. The page does not show the
-- record in this step.
--
-- NOT CHANGED: account export still leaves out turns entirely (HANDOFF-CODE.md §7, open).
-- ===========================================================================

begin;

alter table public.turns add column if not exists check_record jsonb;

comment on column public.turns.check_record is
  'HR answers only (Step 6b): what the answer was given and how its quotes and links were checked. NULL on every workspace turn.';

-- ===========================================================================
-- VERIFY. Raises unless every line holds; read back, never taken from the statement above.
-- ===========================================================================
do $$
declare n int; nullable text; typ text;
begin
  select is_nullable, data_type into nullable, typ from information_schema.columns
   where table_schema = 'public' and table_name = 'turns' and column_name = 'check_record';
  if typ is distinct from 'jsonb' then
    raise exception 'MIGRATION 069 FAILED: turns.check_record is %, not jsonb.', coalesce(typ, 'missing');
  end if;
  if nullable <> 'YES' then
    raise exception 'MIGRATION 069 FAILED: turns.check_record is not nullable, so a workspace turn could not be saved without it.';
  end if;

  -- A person reads and writes it exactly as the rest of the row: SELECT and INSERT, never UPDATE.
  if not has_column_privilege('authenticated', 'public.turns', 'check_record', 'SELECT')
     or not has_column_privilege('authenticated', 'public.turns', 'check_record', 'INSERT') then
    raise exception 'MIGRATION 069 FAILED: authenticated cannot read or write turns.check_record.';
  end if;
  if has_column_privilege('authenticated', 'public.turns', 'check_record', 'UPDATE')
     or has_column_privilege('authenticated', 'public.turns', 'text', 'UPDATE') then
    raise exception 'MIGRATION 069 FAILED: authenticated may UPDATE turns, which 031 never granted.';
  end if;
  -- ...and the check above can see a presence: the same question about `text`, a column 031 covers.
  if not has_column_privilege('authenticated', 'public.turns', 'text', 'INSERT') then
    raise exception 'MIGRATION 069 FAILED: the privilege check sees nothing on turns.text either, so it proves nothing.';
  end if;
  if has_column_privilege('anon', 'public.turns', 'check_record', 'SELECT') then
    raise exception 'MIGRATION 069 FAILED: anon can read turns.check_record.';
  end if;

  -- Every existing turn is NULL: the column was added empty, and nothing was backfilled.
  select count(*) into n from public.turns where check_record is not null;
  if n <> 0 then
    raise exception 'MIGRATION 069 FAILED: % existing turn(s) carry a check record.', n;
  end if;

  raise notice 'MIGRATION 069 VERIFIED: turns.check_record jsonb, nullable; authenticated SELECT and INSERT, no UPDATE (as the rest of the row); anon nothing; every existing turn NULL.';
end $$;

commit;
