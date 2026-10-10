-- ===========================================================================
-- 078 — A SUMMARY SAYS HOW FAR IT READ
--
-- Fix list **W2**, severity 1 (`docs/FIX-LIST-FAILURES.md`, root R5), Job E1.
--
-- **WHY: the deleter takes turns no summary has ever seen.**
--
-- `summarised_at` is stamped with the time the summary was WRITTEN
-- (`lib/summaryReport.ts`), and the turns it read were loaded minutes earlier
-- (`app/api/topics/[id]/summarise/route.ts:76`, before the claim at `:85`). A
-- message sent in between is therefore newer than the turns the model saw and
-- OLDER than `summarised_at`. Two things then read that as "covered":
--
--   · `lib/topicClaim.ts:156` — `spokenSince = last_turn_at > summarised_at`,
--     so the nightly job never re-summarises the conversation; and
--   · `lib/retention.ts:67` — the 12-month deleter's one safety test is
--     `summarised_at >= last_turn_at`, so it decides `clear` and
--     **deletes turns the summary does not contain**. The transcript is
--     disposable and the summary is what survives (`WORKSPACE.md` §6.4) — so
--     what is lost is lost, and the summary never mentioned it.
--
-- **WHAT THIS COLUMN IS.** `summary_covers_through` is the timestamp of the
-- newest turn the summary actually read — a fact about the summary, with no
-- race in it, because the run computes it from the turns in its own hand. It is
-- not "when we wrote it", which is what `summarised_at` is for and what the
-- drawers print ("Summarised 5 January"). The two are different questions and
-- were being answered by one column.
--
-- *** WHY NOT REUSE `summarised_at`. *** It is also the token the screens watch
-- to know a summary has landed (`app/compliance/page.tsx:714`,
-- `app/hr/HrWorkspace.tsx:444`: `row.summarised_at !== w.before`). Moving it
-- back to the last turn's time would mean a re-summary of an unchanged
-- conversation wrote the identical value, and the page would never notice the
-- new summary at all.
--
-- **THE BACKFILL IS DELIBERATELY NARROW, AND SAYS WHAT IT ASSUMES.** For an
-- existing row there is no record of which turns its summary read. So:
--
--   · where `summarised_at >= last_turn_at`, the column is set to
--     `last_turn_at`. That asserts nothing new: it is exactly what the two
--     readers above already believe of those rows, and already act on.
--   · everywhere else it stays NULL, and NULL means **not known**. The deleter
--     treats that as "do not clear" (`clearingDecision` → `skip_not_covered`),
--     which is the direction that cannot lose anything: those rows are the ones
--     today's code already skips.
--
-- No grant is needed — adding a column to a table carries the table's own
-- grants, and `topics` was granted in migrations 003–010 and re-read in 066–068.
-- ===========================================================================

begin;

alter table public.topics add column if not exists summary_covers_through timestamptz;

comment on column public.topics.summary_covers_through is
  'The newest turn the stored summary actually read (fix list W2, migration 078). NOT when the '
  'summary was written — that is summarised_at, which the drawers print and the screens watch. '
  'NULL means we do not know how far it read, and the 12-month deleter must not clear the turns.';

update public.topics
   set summary_covers_through = last_turn_at
 where summary_covers_through is null
   and last_turn_at is not null
   and summarised_at is not null
   and summarised_at >= last_turn_at;

-- An index is NOT added. The deleter already narrows on `last_turn_at` (`clearingCutoff`) and then
-- decides per topic in code; this column is read from rows that query has already returned, so an
-- index on it would be paid for on every write and read by nothing.

-- ===========================================================================
-- VERIFY — §3.7: the column, the backfill's rule, and that NULL still means NULL.
-- ===========================================================================
do $$
declare co uuid; a uuid; b uuid; c uuid; n int; v timestamptz;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'topics'
       and column_name = 'summary_covers_through' and data_type = 'timestamp with time zone'
  ) then
    raise exception 'MIGRATION 078 FAILED: topics.summary_covers_through is not there, or not a timestamptz.';
  end if;

  insert into public.companies (name) values ('078 probe') returning id into co;

  -- (a) A summarised conversation whose summary is NEWER than its last turn: the backfill's case.
  insert into public.topics (company_id, title, last_turn_at, summarised_at, summary)
       values (co, '078 covered', '2026-01-10T10:00:00Z', '2026-01-10T10:05:00Z', 'a summary')
    returning id into a;
  -- (b) One whose last turn is NEWER than the summary: today's code already skips it, so it must
  --     stay NULL rather than be given a coverage nobody can vouch for.
  insert into public.topics (company_id, title, last_turn_at, summarised_at, summary)
       values (co, '078 spoken since', '2026-01-10T11:00:00Z', '2026-01-10T10:05:00Z', 'a summary')
    returning id into b;
  -- (c) One never summarised.
  insert into public.topics (company_id, title, last_turn_at)
       values (co, '078 never summarised', '2026-01-10T11:00:00Z')
    returning id into c;

  -- The rows just inserted are AFTER the backfill above, so the backfill is re-run over this
  -- company only — the same statement, so what it asserts is tested rather than described.
  update public.topics
     set summary_covers_through = last_turn_at
   where company_id = co
     and summary_covers_through is null
     and last_turn_at is not null
     and summarised_at is not null
     and summarised_at >= last_turn_at;

  select summary_covers_through into v from public.topics where id = a;
  if v is null or v <> '2026-01-10T10:00:00Z'::timestamptz then
    raise exception 'MIGRATION 078 FAILED: a covered conversation was not backfilled to its last turn (got %).', v;
  end if;

  select count(*) into n from public.topics
   where id in (b, c) and summary_covers_through is not null;
  if n <> 0 then
    raise exception 'MIGRATION 078 FAILED: % row(s) were given a coverage nobody can vouch for.', n;
  end if;

  -- And the column accepts a value the application writes, which is the whole point of it.
  update public.topics set summary_covers_through = '2026-02-01T09:00:00Z' where id = c;
  select summary_covers_through into v from public.topics where id = c;
  if v <> '2026-02-01T09:00:00Z'::timestamptz then
    raise exception 'MIGRATION 078 FAILED: the column did not keep what was written to it.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 078 VERIFIED: summary_covers_through exists as a timestamptz; a conversation whose summary was newer than its last turn is backfilled to that turn; one spoken in since, and one never summarised, stay NULL; and the column keeps what is written to it.';
end $$;

commit;
