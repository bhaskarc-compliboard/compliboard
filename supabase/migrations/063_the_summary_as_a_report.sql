-- ===========================================================================
-- 063 — THE SUMMARY AS A REPORT, AND THE CONVERSATIONS LIST IN ONE READ
-- ===========================================================================
-- WHY. Workspace Task 5.
--
-- 1. topics.summary_report jsonb. The summary becomes a structured report — the person's situation,
--    what applies grouped by authority, what is still to confirm, what was asked and not answered,
--    and the sources numbered by code — written by one model call and checked by
--    `lib/summaryReport.ts`. **`topics.summary` (text) is KEPT AND STILL FILLED**, with a plain-text
--    rendering of the report, because every existing reader reads it (the workspace drawer and list,
--    `GET /api/topics/:id`, `/api/checklists/from-topic`, the nightly deleter's "has a summary" test,
--    the nightly job). A summary written before this migration has no report and is shown as text,
--    exactly as before.
--
-- 2. topic_list_v. The Conversations list made 1 + 2N reads: a turn count and a checklist per topic
--    (`docs/WORKSPACE-MACHINERY.md` 2a). Its rows now also need the number of questions, the first
--    file's name and the checklist's progress. Fetching every turn of 60 conversations in one read
--    instead would run into PostgREST's row cap (1,000 by default) and silently miscount, so the
--    counts are computed in the database, per topic, and the list is ONE read. `security_invoker`,
--    so every base-table policy applies to the caller exactly as a direct read would.
--
-- WHAT THIS DOES NOT CHANGE. No existing column, policy or grant on topics. Nothing writes the view.
-- ===========================================================================

begin;

alter table public.topics add column if not exists summary_report jsonb;

-- A report is an object or nothing. A string or an array here would be a write that went wrong.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'topics_summary_report_is_an_object') then
    alter table public.topics add constraint topics_summary_report_is_an_object
      check (summary_report is null or jsonb_typeof(summary_report) = 'object');
  end if;
end $$;

create or replace view public.topic_list_v with (security_invoker = true) as
select
  t.id, t.company_id, t.title, t.summary, t.summarised_at, t.summary_source,
  t.delete_after, t.last_turn_at, t.created_at,
  (t.summary_report is not null)                 as has_report,
  coalesce(tc.turn_count, 0)                     as turn_count,
  coalesce(tc.question_count, 0)                 as question_count,
  coalesce(tc.document_count, 0)                 as document_count,
  fd.first_document_name,
  cl.id                                          as checklist_id,
  coalesce(cl.total, 0)                          as checklist_total,
  coalesce(cl.done, 0)                           as checklist_done
from public.topics t
left join lateral (
  select count(*)                                               as turn_count,
         count(*) filter (where tu.role = 'user')               as question_count,
         count(distinct coalesce(tu.document_id::text, tu.document_name))
           filter (where tu.document_name is not null)          as document_count
    from public.turns tu where tu.topic_id = t.id
) tc on true
left join lateral (
  select tu.document_name as first_document_name
    from public.turns tu
   where tu.topic_id = t.id and tu.document_name is not null
   order by tu.position limit 1
) fd on true
left join lateral (
  select c.id,
         (select count(*) from public.checklist_items i
           where i.checklist_id = c.id and i.parent_item_index is null)                 as total,
         (select count(*) from public.checklist_items i
           where i.checklist_id = c.id and i.parent_item_index is null and i.completed) as done
    from public.checklists c
   where c.from_topic_id = t.id
   order by c.created_at desc limit 1
) cl on true;

-- Default privileges on `public` grant anon and authenticated everything on a new relation
-- (CLAUDE.md §3.6). REVOKE first, then grant only what the list needs.
revoke all on public.topic_list_v from anon;
revoke all on public.topic_list_v from authenticated;
grant select on public.topic_list_v to authenticated;
grant select on public.topic_list_v to service_role;

-- ===========================================================================
-- VERIFY — by attempting the writes and reading the answers back.
-- ===========================================================================
do $$
declare
  co uuid; tp uuid; cl uuid; v record; n int;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 063 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.topics (company_id, title) values (co, 'probe') returning id into tp;
  insert into public.turns (topic_id, company_id, position, role, text, document_name) values
    (tp, co, 1, 'user', 'q1', 'first.pdf'),
    (tp, co, 2, 'assistant', 'a1', null),
    (tp, co, 3, 'user', 'q2', 'second.pdf'),
    (tp, co, 4, 'assistant', 'a2', null),
    (tp, co, 5, 'user', 'q3', 'first.pdf');
  insert into public.checklists (company_id, title, question, from_topic_id)
       values (co, 'probe list', 'probe', tp) returning id into cl;
  insert into public.checklist_items (checklist_id, company_id, category, name, sort_order, completed) values
    (cl, co, 'must_do', 'one', 0, true), (cl, co, 'must_do', 'two', 1, false), (cl, co, 'must_do', 'three', 2, false);
  -- a micro-step: not a top-level item, must not count
  insert into public.checklist_items (checklist_id, company_id, category, name, sort_order, completed, parent_item_index)
       values (cl, co, 'must_do', 'step', 0, true, 0);

  select * into v from public.topic_list_v where id = tp;
  if v.turn_count <> 5 or v.question_count <> 3 or v.document_count <> 2
     or v.first_document_name <> 'first.pdf' or v.checklist_id <> cl
     or v.checklist_total <> 3 or v.checklist_done <> 1 or v.has_report then
    raise exception 'MIGRATION 063 FAILED: topic_list_v counted wrong: %', row_to_json(v);
  end if;

  -- the report column takes an object, and refuses anything else
  update public.topics set summary_report = '{"title":"x"}'::jsonb where id = tp;
  select has_report into v from public.topic_list_v where id = tp;
  if not v.has_report then raise exception 'MIGRATION 063 FAILED: has_report did not follow the column.'; end if;
  begin
    update public.topics set summary_report = '"a string"'::jsonb where id = tp;
    raise exception 'MIGRATION 063 FAILED: a non-object report was accepted.';
  exception when check_violation then null; end;

  -- privileges, read back
  if has_table_privilege('anon', 'public.topic_list_v', 'SELECT') then
    raise exception 'MIGRATION 063 FAILED: anon can read topic_list_v.';
  end if;
  if not has_table_privilege('authenticated', 'public.topic_list_v', 'SELECT')
     or has_table_privilege('authenticated', 'public.topic_list_v', 'INSERT') then
    raise exception 'MIGRATION 063 FAILED: authenticated holds the wrong privileges on topic_list_v.';
  end if;
  select count(*) into n from pg_class c where c.relname = 'topic_list_v'
     and c.reloptions @> array['security_invoker=true'];
  if n <> 1 then raise exception 'MIGRATION 063 FAILED: topic_list_v is not security_invoker.'; end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 063 VERIFIED: summary_report holds an object or nothing; topic_list_v counts '
    'turns, questions, distinct files, the first file and top-level checklist progress, runs as the caller, '
    'and anon cannot read it.';
end $$;

commit;
