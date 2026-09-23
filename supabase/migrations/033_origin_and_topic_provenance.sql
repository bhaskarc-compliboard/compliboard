-- ============================================================
-- COMPLIBOARD — MIGRATION 033: WHERE A CHECKLIST ITEM CAME FROM
-- ============================================================
--
-- WHY. A checklist converted from a conversation mixes two kinds of item: the ones the
-- conversation actually discussed, and the ones the model added to round the subject out. On
-- screen they look identical, and they are not the same claim.
--
--   origin = 'conversation'  the conversation discussed this, and its source was cited there
--   origin = 'added'         the model added it to cover the subject, with its own source
--
-- This is the same honesty §111 asks of the obligation link — a suggestion must be VISIBLY a
-- suggestion — applied one level down, to provenance rather than authority. **It does NOT link
-- items to obligations; §111 stays deferred** and nothing here touches `obligations`.
--
-- Three columns, all nullable, all additive. §118: no content in migrations.

-- ------------------------------------------------------------
-- 1. checklist_items.origin
--
-- NULLABLE, and that is deliberate: 235 items on production and every item written before today
-- came from the old path, where the distinction did not exist. NULL means "not recorded", which
-- is true of them. Backfilling them to 'conversation' would assert a provenance nobody checked.
-- ------------------------------------------------------------
alter table public.checklist_items add column if not exists origin text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checklist_items_origin_is_known') then
    alter table public.checklist_items add constraint checklist_items_origin_is_known
      check (origin is null or origin in ('conversation', 'added'));
  end if;
end $$;

comment on column public.checklist_items.origin is
  'conversation = discussed in the topic this came from, citing a source the conversation used. '
  'added = the model added it to cover the subject. NULL = written before 22 Sep 2026, when the '
  'distinction did not exist. DECISIONS.md §125.';

-- ------------------------------------------------------------
-- 2. checklists.from_topic_id — which conversation produced this
-- ------------------------------------------------------------
alter table public.checklists add column if not exists from_topic_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checklists_from_topic_fk') then
    -- ON DELETE SET NULL, not CASCADE. A conversation being cleared must NOT take the checklist
    -- with it — the checklist is the kept artifact (§125: summaries and checklists are kept
    -- until the user deletes them) and the transcript is the disposable one. CASCADE here would
    -- invert that exactly.
    alter table public.checklists add constraint checklists_from_topic_fk
      foreign key (from_topic_id) references public.topics(id) on delete set null;
  end if;
end $$;

comment on column public.checklists.from_topic_id is
  'The conversation this was converted from. ON DELETE SET NULL — clearing a topic must never '
  'delete the checklist made from it.';

-- ------------------------------------------------------------
-- 3. documents.from_topic_id — a file uploaded inside a conversation
--
-- ONE COLUMN, NOT A PARALLEL STORE. A file uploaded in research goes through the existing
-- documents + document_reviews path unchanged; this only records where it came in.
-- ------------------------------------------------------------
alter table public.documents add column if not exists from_topic_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_from_topic_fk') then
    alter table public.documents add constraint documents_from_topic_fk
      foreign key (from_topic_id) references public.topics(id) on delete set null;
  end if;
end $$;

comment on column public.documents.from_topic_id is
  'The conversation a file was uploaded from, when it was. NULL for every document uploaded '
  'through the Documents screen. ON DELETE SET NULL — the document outlives the transcript.';

create index if not exists idx_checklists_from_topic on public.checklists (from_topic_id) where from_topic_id is not null;
create index if not exists idx_documents_from_topic on public.documents (from_topic_id) where from_topic_id is not null;

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare
  n int;
  cl uuid;
begin
  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='checklist_items' and column_name='origin' and is_nullable='YES';
  if n <> 1 then raise exception 'MIGRATION 033 FAILED: checklist_items.origin missing or NOT NULL.'; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='checklists' and column_name='from_topic_id';
  if n <> 1 then raise exception 'MIGRATION 033 FAILED: checklists.from_topic_id missing.'; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='documents' and column_name='from_topic_id';
  if n <> 1 then raise exception 'MIGRATION 033 FAILED: documents.from_topic_id missing.'; end if;

  -- Both FKs must be SET NULL, not CASCADE. This is the one that would quietly destroy a
  -- customer's checklist when their transcript expired, so it is asserted rather than assumed.
  select count(*) into n from pg_constraint
   where conname in ('checklists_from_topic_fk', 'documents_from_topic_fk') and confdeltype = 'n';
  if n <> 2 then
    raise exception 'MIGRATION 033 FAILED: a from_topic_id FK is not ON DELETE SET NULL (found % of 2).', n;
  end if;

  -- THE CHECK, TESTED BY VIOLATING IT (§3.7).
  select id into cl from public.checklists limit 1;
  if cl is not null then
    begin
      insert into public.checklist_items (checklist_id, company_id, name, category, origin)
      select cl, company_id, '__mig033_probe__', 'must_do', 'invented'
        from public.checklists where id = cl;
      raise exception 'MIGRATION 033 FAILED: origin accepted a value outside (conversation, added).';
    exception when check_violation then null;
    end;
    delete from public.checklist_items where name = '__mig033_probe__';
  end if;

  raise notice 'MIGRATION 033 OK: origin added (nullable, constrained), two from_topic_id columns both ON DELETE SET NULL.';
end $$;
