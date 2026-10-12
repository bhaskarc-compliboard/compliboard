-- ===========================================================================
-- 080 — EVERY MODEL CALL SAYS WHY IT STOPPED
--
-- The owner's decision **D3.4**, 12 October 2026
-- (`docs/reports/jobE-independent-review.md` §7), out of E9 item 2 and the
-- independent read's §3.
--
-- **WHY: we changed how a stopped answer behaves and could not count them.**
--
-- Job E's S2 made `max_tokens` and `pause_turn` mean "unfinished" rather than
-- "finished" — which is right: an answer cut off mid-sentence was being saved
-- and shown as a complete one. But nothing recorded WHY a call stopped, so the
-- question "how often does this actually happen, and on which task" had no
-- answer anywhere in the product. E9 item 2 went looking and found that
-- `ai_calls` has no such column and neither does any other table; the only
-- trace is the consequence, `turns.stopped`, which exists for chat answers
-- alone and says nothing about the handbook check, the audit or a summary.
--
-- So the ceiling in D3.2 was raised on a measurement taken from
-- `max(output_tokens)` — close, but not the thing itself. A call that stopped at
-- the ceiling and a call that finished 40 tokens under it are indistinguishable
-- by token count, and the first is a broken answer while the second is a good
-- one.
--
-- **WHAT THIS COLUMN IS.** Anthropic's own `stop_reason`, copied onto the ledger
-- row at the call, verbatim and unmapped: `end_turn`, `max_tokens`,
-- `stop_sequence`, `tool_use`, `pause_turn`, `refusal`. Verbatim because a value
-- we have not seen before must arrive as itself rather than as "other" — that is
-- how `pause_turn` came to be treated as a failure in the first place.
--
-- NULL means **not recorded**, not "finished cleanly": every row written before
-- this migration is NULL, and so is any call whose response carried no
-- `stop_reason` at all. There is deliberately NO default and NO backfill — a
-- guess about why 363 past calls stopped is exactly the kind of record
-- `CLAUDE.md` §9.1 forbids.
--
-- No grant is needed: a new column carries the table's own grants, and
-- `ai_calls` was granted in migrations 003–010 and re-read in 066–068.
-- ===========================================================================

begin;

alter table public.ai_calls add column if not exists stop_reason text;

comment on column public.ai_calls.stop_reason is
  'Why the model stopped, verbatim from the API: end_turn, max_tokens, stop_sequence, tool_use, '
  'pause_turn, refusal (the owner''s decision D3.4, migration 080). NULL means NOT RECORDED — '
  'every row written before 12 October 2026 is NULL, and so is a response that carried no '
  'stop_reason. It is never a guess: nothing backfills it.';

-- An index is NOT added. It is read by a hand-written count over a date window (E9 item 2's
-- query shape), not by anything on a page, so an index would be paid for on every call and
-- read by nothing.

-- ===========================================================================
-- VERIFY — §3.7: the column exists as text, it keeps what is written to it,
-- NULL stays NULL, and no past row was given a value.
-- ===========================================================================
do $$
declare co uuid; a uuid; b uuid; v text; n int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ai_calls'
       and column_name = 'stop_reason' and data_type = 'text'
  ) then
    raise exception 'MIGRATION 080 FAILED: ai_calls.stop_reason is not there, or is not text.';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ai_calls'
       and column_name = 'stop_reason' and column_default is not null
  ) then
    raise exception 'MIGRATION 080 FAILED: stop_reason has a default, so "not recorded" would be '
                    'indistinguishable from a reason nobody saw.';
  end if;

  insert into public.companies (name) values ('080 probe') returning id into co;

  insert into public.ai_calls (company_id, task, model, stop_reason)
       values (co, 'summarise', 'claude-haiku-4-5', 'max_tokens') returning id into a;
  insert into public.ai_calls (company_id, task, model)
       values (co, 'summarise', 'claude-haiku-4-5') returning id into b;

  select stop_reason into v from public.ai_calls where id = a;
  if v is distinct from 'max_tokens' then
    raise exception 'MIGRATION 080 FAILED: the column did not keep what was written to it (got %).', v;
  end if;

  select count(*) into n from public.ai_calls where id = b and stop_reason is not null;
  if n <> 0 then
    raise exception 'MIGRATION 080 FAILED: a call that recorded no reason was given one.';
  end if;

  -- A value nobody has seen before must be storable as itself, not refused into a bucket.
  update public.ai_calls set stop_reason = 'something_new' where id = b;
  select stop_reason into v from public.ai_calls where id = b;
  if v <> 'something_new' then
    raise exception 'MIGRATION 080 FAILED: an unfamiliar stop reason was not kept verbatim.';
  end if;

  delete from public.ai_calls where id in (a, b);
  delete from public.companies where id = co;
  raise notice 'MIGRATION 080 VERIFIED: ai_calls.stop_reason exists as text with no default; it keeps a known reason, keeps an unfamiliar one verbatim, and a call that recorded none stays NULL.';
end $$;

commit;
