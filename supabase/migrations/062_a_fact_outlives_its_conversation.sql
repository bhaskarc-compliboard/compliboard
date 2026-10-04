-- ===========================================================================
-- 062 — A FACT OUTLIVES ITS CONVERSATION
-- ===========================================================================
-- WHY.
--
-- Deleting a conversation deleted every fact proposal read out of it — pending, accepted AND
-- rejected — because `fact_proposals.topic_id` was `on delete cascade` (034:21). That contradicts
-- 034's own reasoning (034:97–98: "rejecting is a status, not a disappearance — 'we looked at this
-- and said no' is worth keeping") and the owner's decision of 3 October 2026: **facts belong to
-- Company information, and deleting a conversation must not remove them from the queue or erase
-- what was decided.** A person deletes a transcript because they are done with the conversation, not
-- because they withdraw the fact they told us in it. (`docs/WORKSPACE-MACHINERY.md` N7.)
--
-- WHAT THIS CHANGES.
--
--   1. fact_proposals.topic_title text — the conversation's title, copied onto a conversation-
--      sourced proposal WHEN THE PROPOSAL IS WRITTEN, by a trigger, so it is still readable after
--      the conversation is gone. Copied at insert rather than at delete: a title is set on the
--      first turn and never renamed (lib/conversation.ts setTitleIfFirst), so the two are the same
--      value, and an insert trigger stays out of the cascade a whole-company delete runs.
--      Existing conversation rows are back-filled from `topics`.
--
--   2. fact_proposals.topic_id → topics becomes ON DELETE SET NULL (was CASCADE).
--
--   3. fact_proposals_one_source is widened by exactly one case, shown below.
--
-- THE CHECK, BEFORE (040:184–188):
--
--   (topic_id is not null and document_id is null)
--   or (topic_id is null and document_id is not null)
--
-- THE CHECK, AFTER:
--
--   (topic_id is not null and document_id is null)
--   or (topic_id is null and document_id is not null)
--   or (topic_id is null and document_id is null
--       and source = 'conversation' and topic_title is not null)
--
-- The third arm is the row a deleted conversation leaves behind: no link, but a conversation's
-- proposal that can still say which conversation. A row with neither link AND no title is still
-- refused — "where did this come from" must always have an answer. No term can be NULL (`source`
-- is NOT NULL, the rest are IS NULL tests), so the CLAUDE.md §3.7 NULL trap does not apply; the
-- verify block below tries to break it anyway.
--
-- WHAT THIS DOES NOT CHANGE. Documents writes this table (lib/documentScan.ts saveScan): those rows
-- carry a document and no topic, which the first two arms accept exactly as before, and the trigger
-- does nothing when topic_id is null. A document deleted still takes its proposals with it
-- (document_id stays ON DELETE CASCADE) — that is a different decision and not this one. No grant,
-- no policy and no other table is touched; the verify block reads the privileges back.
-- ===========================================================================

alter table public.fact_proposals add column if not exists topic_title text;

-- ---- 1. the title, back-filled for every existing conversation-sourced row ----
update public.fact_proposals fp
   set topic_title = t.title
  from public.topics t
 where fp.topic_id = t.id and fp.topic_title is null;

-- ---- ...and written by the database for every new one, whoever inserts it ----
create or replace function public.fact_proposals_stamp_topic_title()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.topic_id is not null and new.topic_title is null then
    select t.title into new.topic_title from public.topics t where t.id = new.topic_id;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_topic_title_fact_proposals on public.fact_proposals;
create trigger stamp_topic_title_fact_proposals
  before insert on public.fact_proposals
  for each row execute function public.fact_proposals_stamp_topic_title();

-- ---- 2. the link empties instead of taking the row with it ----
-- Name confirmed on staging before writing this: fact_proposals_topic_id_fkey,
-- FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE.
alter table public.fact_proposals drop constraint if exists fact_proposals_topic_id_fkey;
alter table public.fact_proposals
  add constraint fact_proposals_topic_id_fkey
  foreign key (topic_id) references public.topics(id) on delete set null;

-- ---- 3. the one-source check, widened for that row and no other ----
alter table public.fact_proposals drop constraint if exists fact_proposals_one_source;
alter table public.fact_proposals
  add constraint fact_proposals_one_source
  check ((topic_id is not null and document_id is null)
      or (topic_id is null and document_id is not null)
      or (topic_id is null and document_id is null
          and source = 'conversation' and topic_title is not null));

-- ===========================================================================
-- VERIFY — by attempting the writes, not by reading the definitions.
-- ===========================================================================
do $$
declare
  co uuid; tp uuid; doc uuid;
  p_pending uuid; p_accepted uuid; p_rejected uuid; p_doc uuid;
  n int; t text;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 062 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.topics (company_id, title) values (co, 'Forklifts at the Salem plant')
       returning id into tp;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'migration-062-probe.pdf', 'probe/062', 'application/pdf') returning id into doc;

  -- ---- 1. a conversation proposal is stamped with its conversation's title ----
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value)
       values (co, tp, 'has_forklifts', 'yes') returning id into p_pending;
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value, status)
       values (co, tp, 'employee_count', '47', 'accepted') returning id into p_accepted;
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value, status)
       values (co, tp, 'has_hazmat', 'no', 'rejected') returning id into p_rejected;
  select topic_title into t from public.fact_proposals where id = p_pending;
  if t is distinct from 'Forklifts at the Salem plant' then
    raise exception 'MIGRATION 062 FAILED: a conversation proposal was not stamped with its title (got %).', t;
  end if;

  -- ---- 2. a document proposal is written exactly as before, and gets no title ----
  insert into public.fact_proposals (company_id, document_id, source, switch_key, proposed_value)
       values (co, doc, 'document', 'facility_address', '1 Probe Way') returning id into p_doc;
  select topic_title into t from public.fact_proposals where id = p_doc;
  if t is not null then
    raise exception 'MIGRATION 062 FAILED: a document proposal was given a conversation title.';
  end if;

  -- ---- 3. deleting the conversation keeps all three, link emptied, title kept ----
  delete from public.topics where id = tp;
  select count(*) into n from public.fact_proposals
   where id in (p_pending, p_accepted, p_rejected)
     and topic_id is null and topic_title = 'Forklifts at the Salem plant';
  if n <> 3 then
    raise exception 'MIGRATION 062 FAILED: % of 3 proposals survived their conversation with its title.', n;
  end if;
  select count(*) into n from public.fact_proposals
   where id = p_accepted and status = 'accepted';
  if n <> 1 then raise exception 'MIGRATION 062 FAILED: a decision was lost with the conversation.'; end if;

  -- ---- 4. the check still refuses a row that cannot say where it came from ----
  begin
    insert into public.fact_proposals (company_id, switch_key, proposed_value)
         values (co, 'orphan', 'x');
    raise exception 'MIGRATION 062 FAILED: a proposal with no source and no title was accepted.';
  exception when check_violation then null; end;
  begin
    insert into public.fact_proposals (company_id, source, switch_key, proposed_value, topic_title)
         values (co, 'document', 'orphan', 'x', 'a title');
    raise exception 'MIGRATION 062 FAILED: a document-sourced row with no document was accepted.';
  exception when check_violation then null; end;
  begin
    insert into public.topics (company_id, title) values (co, 'second probe') returning id into tp;
    insert into public.fact_proposals (company_id, topic_id, document_id, switch_key, proposed_value)
         values (co, tp, doc, 'both', 'x');
    raise exception 'MIGRATION 062 FAILED: a proposal with BOTH a topic and a document was accepted.';
  exception when check_violation then null; end;

  -- ---- 5. a deleted document still takes its own proposals (unchanged) ----
  delete from public.documents where id = doc;
  select count(*) into n from public.fact_proposals where id = p_doc;
  if n <> 0 then raise exception 'MIGRATION 062 FAILED: a document proposal outlived its document.'; end if;

  -- ---- 6. deleting the company removes everything, orphans included ----
  delete from public.companies where id = co;
  select count(*) into n from public.fact_proposals where company_id = co;
  if n <> 0 then raise exception 'MIGRATION 062 FAILED: % proposals outlived their company.', n; end if;

  -- ---- 7. privileges, read back: a new column is a chance to widen one by accident ----
  if has_table_privilege('anon', 'public.fact_proposals', 'SELECT')
     or has_table_privilege('anon', 'public.fact_proposals', 'INSERT')
     or has_table_privilege('authenticated', 'public.fact_proposals', 'INSERT')
     or has_table_privilege('authenticated', 'public.fact_proposals', 'DELETE') then
    raise exception 'MIGRATION 062 FAILED: adding a column changed who holds what on fact_proposals.';
  end if;
  if not has_table_privilege('authenticated', 'public.fact_proposals', 'SELECT')
     or not has_table_privilege('authenticated', 'public.fact_proposals', 'UPDATE') then
    raise exception 'MIGRATION 062 FAILED: a privilege fact_proposals needs has gone.';
  end if;

  raise notice 'MIGRATION 062 VERIFIED: a conversation proposal carries its title, outlives its '
    'conversation pending, accepted and rejected alike, a row with no source and no title is still '
    'refused, document proposals are unchanged, and no privilege moved.';
end $$;
