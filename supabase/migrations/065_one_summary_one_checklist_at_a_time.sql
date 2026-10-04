-- ===========================================================================
-- 065 — ONE SUMMARY AND ONE CHECKLIST AT A TIME, RECORDED IN THE DATABASE
-- ===========================================================================
-- WHY. Workspace Stage 4, Part 1, measured on staging on 4 October 2026: a second press of
-- "Summarise this conversation" or "Turn this into a checklist" — in the same tab or another —
-- started a second paid call. Two summaries overwrote each other; two checklists were made. And
-- nothing was recorded while either ran, so a reload, a second tab or the nightly job could not
-- tell that work was already under way.
--
-- 1. topics.summary_started_at and topics.checklist_started_at — THE CLAIM, in the same shape as
--    checklist_items.howto_started_at (migration 064). A route sets one by compare-and-set before
--    any model call, and clears it when the work ends, fails or times out. A claim older than ten
--    minutes is a run that died without clearing it, and the next press may take it
--    (`lib/topicClaim.ts`, CLAIM_LOCK_MS — the same ten minutes as HOWTO_LOCK_MS).
--
-- 2. topic_list_v gains summary_in_progress and checklist_in_progress: whether each claim is set
--    and younger than ten minutes, computed in the database so the Conversations row and the
--    summary drawer read it in the same single read as everything else. Appended at the end, as
--    `create or replace view` requires; every existing column is unchanged.
--
-- 3. A pending fact proposal cannot exist twice for one conversation, key and value. The summary
--    writer read the pending proposals and then inserted (`lib/summaryReport.ts`), so two writers
--    at once could both insert the same one. The index compares exactly as `proposalsToInsert`
--    does — trimmed and lower-cased — and covers only pending rows with a conversation: an
--    accepted or rejected proposal is history and may repeat, and a document's proposals carry no
--    topic. Counted before writing this, on 4 October 2026, with the same grouping: staging 0
--    duplicate groups of 5 pending conversation rows (65 rows in all); production 0 of 8 (47 in all).
--
-- WHAT THIS DOES NOT CHANGE. No policy or grant on topics or fact_proposals. The view keeps
-- security_invoker, so every base-table policy applies to the caller exactly as before.
-- ===========================================================================

begin;

alter table public.topics add column if not exists summary_started_at timestamptz;
alter table public.topics add column if not exists checklist_started_at timestamptz;

comment on column public.topics.summary_started_at is
  'Workspace Stage 4. Set while a summary is being written for this conversation; cleared when it ends or fails. Older than 10 minutes = a dead run (lib/topicClaim.ts).';
comment on column public.topics.checklist_started_at is
  'Workspace Stage 4. Set while a checklist is being built from this conversation; cleared when it ends or fails. Older than 10 minutes = a dead run (lib/topicClaim.ts).';

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
  coalesce(cl.done, 0)                           as checklist_done,
  coalesce(t.summary_started_at   > now() - interval '10 minutes', false) as summary_in_progress,
  coalesce(t.checklist_started_at > now() - interval '10 minutes', false) as checklist_in_progress
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

-- Restated, not assumed (CLAUDE.md §3.6): REVOKE first, then grant only what the list needs.
revoke all on public.topic_list_v from anon;
revoke all on public.topic_list_v from authenticated;
grant select on public.topic_list_v to authenticated;
grant select on public.topic_list_v to service_role;

create unique index if not exists idx_fact_proposals_company_topic_key_value_pending
  on public.fact_proposals (company_id, topic_id, lower(btrim(switch_key)), lower(btrim(proposed_value)))
  where status = 'proposed' and topic_id is not null;

-- ===========================================================================
-- VERIFY — by attempting the writes and reading the answers back.
-- ===========================================================================
do $$
declare
  co uuid; tp uuid; v record; n int;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 065 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.topics (company_id, title) values (co, 'probe') returning id into tp;

  -- no claim: neither flag
  select * into v from public.topic_list_v where id = tp;
  if v.summary_in_progress or v.checklist_in_progress then
    raise exception 'MIGRATION 065 FAILED: an unclaimed topic reads as in progress: %', row_to_json(v);
  end if;

  -- a fresh claim reads as held; each column drives only its own flag
  update public.topics set summary_started_at = now() where id = tp;
  select * into v from public.topic_list_v where id = tp;
  if not v.summary_in_progress or v.checklist_in_progress then
    raise exception 'MIGRATION 065 FAILED: a fresh summary claim read wrong: %', row_to_json(v);
  end if;
  update public.topics set summary_started_at = null, checklist_started_at = now() - interval '9 minutes' where id = tp;
  select * into v from public.topic_list_v where id = tp;
  if v.summary_in_progress or not v.checklist_in_progress then
    raise exception 'MIGRATION 065 FAILED: a 9-minute checklist claim read wrong: %', row_to_json(v);
  end if;

  -- an 11-minute claim is a dead run: not held
  update public.topics set checklist_started_at = now() - interval '11 minutes' where id = tp;
  select * into v from public.topic_list_v where id = tp;
  if v.checklist_in_progress then
    raise exception 'MIGRATION 065 FAILED: an 11-minute claim still reads as held.';
  end if;

  -- the same pending fact twice, differing only in case and spaces, is refused
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value, status)
       values (co, tp, 'employee_count', '12', 'proposed');
  begin
    insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value, status)
         values (co, tp, ' Employee_Count ', '12 ', 'proposed');
    raise exception 'MIGRATION 065 FAILED: a duplicate pending proposal was accepted.';
  exception when unique_violation then null; end;

  -- history may repeat: the same fact accepted, and again rejected, beside the pending one
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value, status)
       values (co, tp, 'employee_count', '12', 'accepted'), (co, tp, 'employee_count', '12', 'rejected');
  -- a different value is a different proposal
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value, status)
       values (co, tp, 'employee_count', '14', 'proposed');
  select count(*) into n from public.fact_proposals where company_id = co;
  if n <> 4 then raise exception 'MIGRATION 065 FAILED: expected 4 probe proposals, found %.', n; end if;

  -- privileges and security_invoker, read back
  if has_table_privilege('anon', 'public.topic_list_v', 'SELECT') then
    raise exception 'MIGRATION 065 FAILED: anon can read topic_list_v.';
  end if;
  if not has_table_privilege('authenticated', 'public.topic_list_v', 'SELECT')
     or has_table_privilege('authenticated', 'public.topic_list_v', 'INSERT') then
    raise exception 'MIGRATION 065 FAILED: authenticated holds the wrong privileges on topic_list_v.';
  end if;
  select count(*) into n from pg_class c where c.relname = 'topic_list_v'
     and c.reloptions @> array['security_invoker=true'];
  if n <> 1 then raise exception 'MIGRATION 065 FAILED: topic_list_v is not security_invoker.'; end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 065 VERIFIED: the two claims read as held for ten minutes and no longer; '
    'a duplicate pending proposal is refused, history and other values are not; topic_list_v runs as '
    'the caller and anon cannot read it.';
end $$;

commit;
