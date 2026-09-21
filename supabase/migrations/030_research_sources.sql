-- ============================================================
-- COMPLIBOARD — MIGRATION 030: THE SOURCES BELONG TO THE SAVED ANSWER
-- ============================================================
--
-- WHY. `DECISIONS.md` §77 item 4 — the answer cites generously — and §106, which found the
-- citations were being thrown away before anybody saw them. With web search on, the API returns
-- the answer split across many text blocks, each carrying a `citations` array; `lib/ai.ts` kept
-- `block.text` and dropped the rest, so the sources existed in the response and reached no one.
--
-- Fixing the renderer alone would fix the LIVE view and nothing else. A research answer is saved
-- to `checklists.research_answer` and read back days later from the saved list, and printed.
--
--   *** A SAVED ANSWER THAT HAS LOST ITS SOURCES HAS LOST THE THING "CITE GENEROUSLY" WAS FOR. ***
--
-- The markers survive on their own, because they are characters in the prose — but "[3]" with no
-- list behind it is worse than no marker: it looks like a citation and cannot be followed.
--
-- ------------------------------------------------------------
-- WHY jsonb AND NOT A TABLE.
--
-- A source has no life of its own. It is not shared between answers, never queried across rows,
-- never updated, and it dies with the answer it belongs to. A `research_sources` table would be
-- a join to reconstruct one field of one row — and §78's reasoning applies in the small: do not
-- create a second place for something that has exactly one owner.
--
-- The shape is `lib/ai.ts`'s `Source`: [{ "n": 1, "title": "…", "url": "https://…" }]
-- ------------------------------------------------------------

alter table public.checklists
  add column if not exists research_sources jsonb;

comment on column public.checklists.research_sources is
  'What the research answer cited: [{n, title, url}], in marker order, deduplicated by URL. '
  'Written with the answer so the saved and printed views carry the same sources as the live '
  'one (DECISIONS.md §106). NULL for checklists, and for research answers saved before 030.';

-- ------------------------------------------------------------
-- NO GRANT OR POLICY WORK, AND THAT IS WORTH SAYING RATHER THAN ASSUMING.
--
-- Postgres grants and RLS policies are per TABLE, not per column, so a new column on an existing
-- table inherits both. `checklists` already carries the four policies and the caller's grants
-- from migrations 003-010. CLAUDE.md §3.6's "not granting is not denying" trap applies to a new
-- TABLE in `public` picking up the default ACL — there is no new table here.
-- ------------------------------------------------------------

do $$
declare
  n int;
begin
  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='checklists' and column_name='research_sources';
  if n <> 1 then
    raise exception 'MIGRATION 030 FAILED: research_sources was not added.';
  end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='checklists'
     and column_name='research_sources' and data_type='jsonb';
  if n <> 1 then
    raise exception 'MIGRATION 030 FAILED: research_sources is not jsonb.';
  end if;

  -- The column must be nullable: every checklist row has no sources, and so does every research
  -- answer written before today. A NOT NULL here would refuse the table's own history.
  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='checklists'
     and column_name='research_sources' and is_nullable='YES';
  if n <> 1 then
    raise exception 'MIGRATION 030 FAILED: research_sources is NOT NULL; existing rows have none.';
  end if;

  -- anon holds nothing on checklists and this column changes nothing about that. Asserted
  -- because the cheapest moment to notice a widened grant is the migration that touched the table.
  select count(*) into n from information_schema.role_table_grants
   where table_schema='public' and table_name='checklists' and grantee='anon';
  if n > 0 then
    raise exception 'MIGRATION 030 FAILED: anon holds % grant(s) on checklists.', n;
  end if;

  raise notice 'MIGRATION 030 OK: research_sources jsonb, nullable, anon still holds nothing.';
end $$;
