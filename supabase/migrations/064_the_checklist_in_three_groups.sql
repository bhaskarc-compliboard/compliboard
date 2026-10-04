-- ===========================================================================
-- 064 — THE CHECKLIST IN THREE GROUPS, "HOW DO I DO THIS?", AND THE CHECKLISTS TAB IN ONE READ
-- ===========================================================================
-- WHY. Workspace Task 6, the canvas feature boards 8 and 9 (`DECISIONS.md` §154).
--
-- 1. checklist_item_category gains 'to_confirm'. A workspace checklist has three groups: must do
--    (legal obligations, in order), worth doing (advice, stored as 'good_to_have') and to confirm
--    (open questions). The column is a Postgres ENUM (migration 006), so this is `add value` — the
--    two existing values, and everything Documents (`/api/document-checklist`: must_do,
--    good_to_have) and Audits (`/api/audit-checklist`: must_do) write, are untouched.
--
--    *** `add value` CANNOT BE USED IN THE TRANSACTION THAT ADDS IT. *** So nothing below writes
--    'to_confirm': the verify block reads the label back from `pg_enum`, and the write itself is
--    proved on staging after this migration (the same split as 026/027).
--
-- 2. Four columns on checklist_items:
--    · basis            the 6–20 words a "Just what we discussed" item was quoted from. Kept so the
--                       citation check (`lib/checklistConvert.ts`) can be re-read later.
--    · sources          every source that check let stand, as [{title, url}]. An item can rest on
--                       more than one source, and source_url holds one. source_url / source_title
--                       still carry the first, for every reader that knows only those.
--    · howto            "How do I do this?": the checked steps, their URLs and labels, the dropped
--                       count, the date and the model (`lib/howTo.ts` HowToResult). Columns on the
--                       item rather than a table: there is one result per item, it is read with
--                       the item, and an item deleted takes its result with it.
--    · howto_started_at set while a run is researching the item, cleared when it ends or fails.
--                       In the DATABASE, so a reload or a second tab waits instead of paying again
--                       (`app/api/checklist-items/[id]/how-to/route.ts`, the compare-and-set).
--
-- 3. ai_calls.task gains 'howto', so the new call is counted in the ledger under its own name.
--
-- 4. checklist_list_v. The Checklists tab read 1 + N: the checklists, then one read of items per
--    checklist (`docs/HANDOFF-CODE.md` §7). The counts are computed in the database, per checklist,
--    top-level items only, and the tab is ONE read. `security_invoker`, so every base-table policy
--    applies to the caller exactly as a direct read would — the same shape as topic_list_v (063).
--
-- WHAT THIS DOES NOT CHANGE. No existing value, column, policy or grant. Existing micro-step rows
-- (parent_item_index set) stay as they are; the view counts only top-level items, as 063's does.
-- ===========================================================================

alter type public.checklist_item_category add value if not exists 'to_confirm';

begin;

alter table public.checklist_items add column if not exists basis text;
alter table public.checklist_items add column if not exists sources jsonb;
alter table public.checklist_items add column if not exists howto jsonb;
alter table public.checklist_items add column if not exists howto_started_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checklist_items_sources_is_a_list') then
    alter table public.checklist_items add constraint checklist_items_sources_is_a_list
      check (sources is null or jsonb_typeof(sources) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'checklist_items_howto_is_an_object') then
    alter table public.checklist_items add constraint checklist_items_howto_is_an_object
      check (howto is null or jsonb_typeof(howto) = 'object');
  end if;
end $$;

comment on column public.checklist_items.basis is
  'Workspace Task 6. The words a "Just what we discussed" item was quoted from; checked by lib/checklistConvert.ts.';
comment on column public.checklist_items.sources is
  'Workspace Task 6. Every source the citation check let stand, [{title, url}]. source_url holds the first.';
comment on column public.checklist_items.howto is
  'Workspace Task 6. "How do I do this?": checked steps, labels, dropped count, date, model (lib/howTo.ts).';
comment on column public.checklist_items.howto_started_at is
  'Workspace Task 6. Set while "How do I do this?" is researching this item; cleared when it ends or fails.';

alter table public.ai_calls drop constraint if exists ai_calls_task_check;
alter table public.ai_calls add constraint ai_calls_task_check
  check (task = any (array['research', 'checklist', 'substeps', 'convert', 'summarise', 'gate',
                           'critique', 'audit', 'document_review', 'document_scan',
                           'document_draft', 'howto', 'other']));

create or replace view public.checklist_list_v with (security_invoker = true) as
select
  c.id, c.company_id, c.title, c.question, c.created_at,
  c.from_topic_id, c.document_id, c.document_gap_id,
  coalesce(n.total, 0)             as total,
  coalesce(n.done, 0)              as done,
  coalesce(n.must_total, 0)        as must_total,
  coalesce(n.must_done, 0)         as must_done,
  coalesce(n.from_conversation, 0) as from_conversation,
  coalesce(n.added, 0)             as added
from public.checklists c
left join lateral (
  select count(*)                                                        as total,
         count(*) filter (where i.completed)                             as done,
         count(*) filter (where i.category = 'must_do')                  as must_total,
         count(*) filter (where i.category = 'must_do' and i.completed)  as must_done,
         count(*) filter (where i.origin = 'conversation')               as from_conversation,
         count(*) filter (where i.origin = 'added')                      as added
    from public.checklist_items i
   where i.checklist_id = c.id and i.parent_item_index is null
) n on true;

-- Default privileges on `public` grant anon and authenticated everything on a new relation
-- (CLAUDE.md §3.6). REVOKE first, then grant only what the tab needs.
revoke all on public.checklist_list_v from anon;
revoke all on public.checklist_list_v from authenticated;
grant select on public.checklist_list_v to authenticated;
grant select on public.checklist_list_v to service_role;

-- ===========================================================================
-- VERIFY — by attempting the writes and reading the answers back.
-- ===========================================================================
do $$
declare
  co uuid; cl uuid; v record; n int;
begin
  -- the new label exists, and the two old ones are still there
  select count(*) into n from pg_type t join pg_enum e on e.enumtypid = t.oid
   where t.typname = 'checklist_item_category' and e.enumlabel in ('must_do', 'good_to_have', 'to_confirm');
  if n <> 3 then raise exception 'MIGRATION 064 FAILED: checklist_item_category does not hold all three labels.'; end if;

  insert into public.companies (name, industry, state)
       values ('Migration 064 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.checklists (company_id, title, question) values (co, 'probe list', 'probe') returning id into cl;
  insert into public.checklist_items (checklist_id, company_id, category, name, sort_order, completed, origin) values
    (cl, co, 'must_do', 'one', 0, true, 'conversation'),
    (cl, co, 'must_do', 'two', 1, false, 'conversation'),
    (cl, co, 'good_to_have', 'advice', 2, true, 'added');
  -- a micro-step: not a top-level item, must not count
  insert into public.checklist_items (checklist_id, company_id, category, name, sort_order, completed, parent_item_index)
       values (cl, co, 'must_do', 'step', 0, true, 0);

  select * into v from public.checklist_list_v where id = cl;
  if v.total <> 3 or v.done <> 2 or v.must_total <> 2 or v.must_done <> 1
     or v.from_conversation <> 2 or v.added <> 1 then
    raise exception 'MIGRATION 064 FAILED: checklist_list_v counted wrong: %', row_to_json(v);
  end if;

  -- the new columns take their shapes, and refuse anything else
  update public.checklist_items set sources = '[{"title":"t","url":"https://x.gov"}]'::jsonb,
         howto = '{"steps":[]}'::jsonb, howto_started_at = now(), basis = 'six words copied from the answer'
   where checklist_id = cl and name = 'one';
  begin
    update public.checklist_items set sources = '{"url":"x"}'::jsonb where checklist_id = cl and name = 'one';
    raise exception 'MIGRATION 064 FAILED: a sources value that is not a list was accepted.';
  exception when check_violation then null; end;
  begin
    update public.checklist_items set howto = '["a list"]'::jsonb where checklist_id = cl and name = 'one';
    raise exception 'MIGRATION 064 FAILED: a howto value that is not an object was accepted.';
  exception when check_violation then null; end;

  -- the ledger takes the new task and still refuses a misspelling
  insert into public.ai_calls (task, model) values ('howto', 'migration-064-probe');
  begin
    insert into public.ai_calls (task, model) values ('how_to', 'migration-064-probe');
    raise exception 'MIGRATION 064 FAILED: ai_calls.task accepted "how_to".';
  exception when check_violation then null; end;
  delete from public.ai_calls where model = 'migration-064-probe';

  -- privileges, read back
  if has_table_privilege('anon', 'public.checklist_list_v', 'SELECT') then
    raise exception 'MIGRATION 064 FAILED: anon can read checklist_list_v.';
  end if;
  if not has_table_privilege('authenticated', 'public.checklist_list_v', 'SELECT')
     or has_table_privilege('authenticated', 'public.checklist_list_v', 'INSERT') then
    raise exception 'MIGRATION 064 FAILED: authenticated holds the wrong privileges on checklist_list_v.';
  end if;
  select count(*) into n from pg_class c where c.relname = 'checklist_list_v'
     and c.reloptions @> array['security_invoker=true'];
  if n <> 1 then raise exception 'MIGRATION 064 FAILED: checklist_list_v is not security_invoker.'; end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 064 VERIFIED: to_confirm is a category; basis, sources, howto and howto_started_at '
    'exist and refuse the wrong shapes; ai_calls counts howto; checklist_list_v counts top-level items and '
    'must-dos, runs as the caller, and anon cannot read it.';
end $$;

commit;
