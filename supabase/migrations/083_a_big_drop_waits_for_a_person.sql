-- ===========================================================================
-- 083 — A BIG DROP IN THE REQUIREMENTS WAITS FOR A PERSON
--
-- The owner's decision **D2.1**, 12 October 2026, and the half of it that needs
-- somewhere to live (`docs/reports/jobE-independent-review.md` §7).
--
-- **WHY: the note has to still be there on the next page load.**
--
-- D2 says that when a recompute would close all of a company's open
-- requirements, or more than half of them, nothing closes on its own: the
-- current list stays and a note sits on top asking "Have they stopped applying
-- to you?" The two places that can discover this are
--
--   · `/api/switches/answer`, where the person has just answered a question —
--     and D2.3 has it tell them "we've held that for you to confirm on the
--     Requirements page"; and
--   · `/api/obligations`, the Requirements page's own data source.
--
-- The page's source only resolves when `obligations_computed_at` is NULL — lazy,
-- on first request, `DECISIONS.md` §60 — and resolving on every load would cost
-- ~250 ms of round trips on a page that does not need it. So a hold discovered
-- while answering a question has to be WRITTEN DOWN, or the person follows that
-- sentence to the Requirements page and finds the old list with nothing on it
-- explaining anything. A dead end replaced by a different dead end.
--
-- **WHAT THIS COLUMN IS.** The one recompute that was held, as the resolver saw
-- it, so the page can render the note and the buttons without resolving again:
--
--   {
--     "held_at":        "2026-10-12T19:00:00Z",
--     "open_total":     200,       -- open obligations at the time
--     "would_close":    200,       -- how many the recompute would have closed
--     "industry":       "other",   -- the company's industry then
--     "industry_has_library": false,
--     "answer_changed": true       -- an answer was newer than the last compute
--   }
--
-- NULL means **nothing is held**, which is the normal state. The numbers are a
-- record of one moment and are never added up or trended: the page re-reads them
-- to write one sentence, and the next successful recompute clears the column.
--
-- **WHY JSONB AND NOT SIX COLUMNS.** It is one fact — "this recompute was held,
-- and here is what it saw" — written and cleared as a whole, by one writer, and
-- read by one page. Six columns would make "half a hold" expressible, and the
-- state this exists to prevent is exactly a half-recorded one.
--
-- **THE THRESHOLD IS NOT IN THE DATABASE.** D2.2: it is internal and no
-- percentage is ever shown. It lives in `lib/obligationHold.ts` with the tests
-- that pin its edges, because a rule in a column default is a rule nobody can
-- test.
--
-- No grant is needed: a new column carries the table's own grants, and
-- `companies` was granted in migrations 003–010 and re-read in 066–068.
-- ===========================================================================

begin;

alter table public.companies add column if not exists obligations_hold jsonb;

comment on column public.companies.obligations_hold is
  'The one recompute of this company''s requirements that was HELD because it would have closed '
  'all of the open list or more than half of it (the owner''s decision D2, migration 083). Holds '
  'what the resolver saw — open_total, would_close, industry, industry_has_library, '
  'answer_changed, held_at — so the Requirements page can write its note and draw its buttons '
  'without resolving again. NULL means nothing is held, which is the normal state. The next '
  'recompute that is allowed to proceed clears it.';

-- No index: it is read by id, on a page that has already read the company row.

-- ===========================================================================
-- VERIFY — §3.7: the column, that NULL is the normal state, that it keeps a
-- whole hold, and that clearing it is one statement.
-- ===========================================================================
do $$
declare co uuid; v jsonb; n int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'companies'
       and column_name = 'obligations_hold' and data_type = 'jsonb'
  ) then
    raise exception 'MIGRATION 083 FAILED: companies.obligations_hold is not there, or is not jsonb.';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'companies'
       and column_name = 'obligations_hold' and column_default is not null
  ) then
    raise exception 'MIGRATION 083 FAILED: obligations_hold has a default, so every company would '
                    'look as though something were held.';
  end if;

  insert into public.companies (name) values ('083 probe') returning id into co;

  -- Nothing is held, and that is the normal state for every company that exists today.
  select count(*) into n from public.companies where id = co and obligations_hold is null;
  if n <> 1 then
    raise exception 'MIGRATION 083 FAILED: a new company came out with something held.';
  end if;
  select count(*) into n from public.companies where obligations_hold is not null;
  if n <> 0 then
    raise exception 'MIGRATION 083 FAILED: % existing company rows have a hold, and nothing has written one yet.', n;
  end if;

  update public.companies set obligations_hold = jsonb_build_object(
    'held_at', '2026-10-12T19:00:00Z', 'open_total', 200, 'would_close', 200,
    'industry', 'other', 'industry_has_library', false, 'answer_changed', true) where id = co;
  select obligations_hold into v from public.companies where id = co;
  if (v -> 'would_close')::int <> 200 or (v -> 'industry_has_library')::boolean <> false
     or v ->> 'industry' <> 'other' then
    raise exception 'MIGRATION 083 FAILED: the hold did not come back as it was written (got %).', v;
  end if;

  -- And the next recompute that proceeds clears the whole thing, not part of it.
  update public.companies set obligations_hold = null where id = co;
  select count(*) into n from public.companies where id = co and obligations_hold is null;
  if n <> 1 then
    raise exception 'MIGRATION 083 FAILED: the hold could not be cleared.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 083 VERIFIED: companies.obligations_hold exists as jsonb with no default; no existing company has one; it keeps a whole hold and comes back as written; and it clears in one statement.';
end $$;

commit;
