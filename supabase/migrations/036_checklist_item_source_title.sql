-- ============================================================
-- COMPLIBOARD — MIGRATION 036: THE SOURCE'S NAME, BESIDE ITS URL
-- ============================================================
--
-- A GAP LEFT BY RUN 1, FOUND BY RUNNING THE CONVERSION ROUTE.
--
-- Run 1 cut the checklist prompt to a shape that asks for `source_title` beside `source_url`
-- (DECISIONS.md §123), and added `source_title` to `ChecklistItem` in `lib/answerSchema.ts`.
-- **The column was never added.** The model returned it, TypeScript accepted it, and every write
-- since has silently dropped it — PostgREST ignores unknown keys on an insert rather than
-- refusing, so nothing failed and nothing said so.
--
-- It surfaced only when a route inserted the field EXPLICITLY:
--
--     writing the items: Could not find the 'source_title' column of 'checklist_items'
--                        in the schema cache
--
-- That is §3.6's "a column name inside a query string is invisible to tsc" in a new direction —
-- here the type existed and the column did not, and the generated types could not contradict a
-- field the schema had never heard of.
--
-- Nullable, because every item written before today has no title for its source, and a
-- backfill would be asserting a name nobody checked.

alter table public.checklist_items add column if not exists source_title text;

comment on column public.checklist_items.source_title is
  'The readable name of the source, beside source_url — e.g. "OSHA Hazard Communication '
  'Standard". NULL for every item written before 23 Sep 2026. DECISIONS.md §123, §125.';

do $$
declare n int;
begin
  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='checklist_items'
     and column_name='source_title' and is_nullable='YES';
  if n <> 1 then
    raise exception 'MIGRATION 036 FAILED: source_title missing or NOT NULL.';
  end if;
  raise notice 'MIGRATION 036 OK: checklist_items.source_title added, nullable.';
end $$;
