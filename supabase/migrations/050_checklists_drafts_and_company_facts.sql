-- 050 — WHAT A PERSON DOES WITH A REPORT: a checklist, a draft, a confirmed fact.
--
-- Run 4 gave the drawer everything a person can SAY back — a correction, a dismissal, a
-- confirmation. This is everything they can DO with it, and all three need somewhere to live.
--
-- 1. A CHECKLIST MADE FROM A GAP. `checklists` gains `document_id` and `document_gap_id`, both
--    nullable because the existing checklists came from conversations and always will. The gap
--    link is what lets the report show "checklist made 17 Sep · 2 of 5 done" a week later, which
--    is the vision's own example and the reason the link is on the GAP and not only the document.
--    `checklist_items.origin` gains `document`, beside `conversation` and `added`: origin records
--    where an item came FROM, and an item written from a gap in a permit did not come from a
--    conversation.
--
-- 2. A DRAFT OF A MISSING SECTION. Three columns on `document_gaps` rather than a table: a gap
--    has at most one draft, a second request replaces it, and a one-to-one thing in its own table
--    is a join nobody needed. `draft_ai_call_id` is the point of the third column — a draft is
--    the only thing in the drawer that costs money, and the row has to be able to say what it
--    cost. Nullable, like `document_scans.ai_call_id`, because `recordAICall` is deliberately not
--    awaited and the row may be saved before the receipt lands.
--
-- 3. A CONFIRMED FACT WITH NOWHERE TO GO. `fact_proposals` has been written since the nightly
--    summariser shipped and nothing has ever consumed one — there is no accept path at all. Where
--    a proposal's key names a switch in the library, confirming it goes through the existing
--    declared-fact route and lands in `company_switches`, which is right and needs no new table.
--    Where it does not — "the PCQI is Dana Whitfield", "the alarm is monitored by Cascade Fire &
--    Safety" — there has never been anywhere to put it, so those confirmations have simply been
--    impossible. `company_facts` is that place: one row per company per key, carrying which
--    document and which proposal it came from and who confirmed it.
--
--    *** IT IS NOT A SECOND SWITCH TABLE. *** `company_switches` is the 95 facts the obligation
--    engine reads and resolution is deterministic against it (§3.2). Nothing computes anything
--    from `company_facts`; it is what the company has told us about itself, kept so the next scan
--    can be shown it and so a person is not asked twice. The unique key is (company_id, key) —
--    one answer per question, the newest confirmation replacing the last, with the proposal it
--    came from recorded either way.
--
-- WRITES BY THE SERVER, reads by the company. The same reasoning as §132 and 045: these rows are
-- the product's record of what a person confirmed and what a model produced, and RLS can say
-- "your company" but cannot say "through the route that checked the proposal was yours and
-- recorded who confirmed it".

begin;

-- ---------------------------------------------------------------------------
-- 1. Checklists from a gap
-- ---------------------------------------------------------------------------
alter table public.checklists
  add column if not exists document_id uuid references public.documents(id) on delete set null,
  add column if not exists document_gap_id uuid references public.document_gaps(id) on delete set null;

-- ON DELETE SET NULL, not cascade, and the difference is the whole point: deleting a document
-- must not take a checklist somebody has been working through for a fortnight. The checklist
-- survives with its items and loses only the link back.
create index if not exists idx_checklists_company_document
  on public.checklists (company_id, document_id);
create index if not exists idx_checklists_document_gap
  on public.checklists (document_gap_id);

alter table public.checklist_items drop constraint if exists checklist_items_origin_is_known;
alter table public.checklist_items add constraint checklist_items_origin_is_known
  check (origin is null or origin = any (array['conversation', 'added', 'document']));

comment on column public.checklists.document_gap_id is
  'The gap this checklist was made from, when it was made from one. Kept so the report can show '
  'progress against the gap weeks later. SET NULL on delete: the checklist outlives the document.';

-- ---------------------------------------------------------------------------
-- 2. A draft of a missing section
-- ---------------------------------------------------------------------------
alter table public.document_gaps
  add column if not exists draft_text text,
  add column if not exists draft_created_at timestamptz,
  add column if not exists draft_ai_call_id uuid references public.ai_calls(id) on delete set null;

comment on column public.document_gaps.draft_text is
  'A draft of the missing section, written by the model for the person to edit. Never written '
  'into their file. A second request replaces it.';
comment on column public.document_gaps.draft_ai_call_id is
  'The ledger row for the call that wrote the draft — the one action in the report drawer that '
  'costs money, so the row can say what it cost. Nullable: recordAICall is not awaited.';

-- ---------------------------------------------------------------------------
-- 3. Confirmed facts that are not switches
-- ---------------------------------------------------------------------------
create table if not exists public.company_facts (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  key                text not null,
  value              jsonb,
  basis              text not null default 'read' check (basis in ('read', 'inferred')),
  source_document_id uuid references public.documents(id) on delete set null,
  source_proposal_id uuid references public.fact_proposals(id) on delete set null,
  confirmed_by       uuid references auth.users(id) on delete set null,
  confirmed_at       timestamptz not null default now(),
  -- ONE ANSWER PER QUESTION. A second confirmation of the same key replaces the first rather
  -- than accumulating, because two rows saying different things about one fact is not a history,
  -- it is an ambiguity nobody can resolve at read time.
  unique (company_id, key)
);

create index if not exists idx_company_facts_company_key
  on public.company_facts (company_id, key);

comment on table public.company_facts is
  'What a company has confirmed about itself that is NOT one of the 95 switches. Nothing computes '
  'from it — company_switches is what the obligation engine reads. This is kept so the next scan '
  'can be shown it and so a person is not asked the same thing twice.';

-- REVOKE first, for both roles, because default privileges on `public` hand anon and
-- authenticated full DML on a new table before a single GRANT runs (§3.6).
revoke all on table public.company_facts from anon;
revoke all on table public.company_facts from authenticated;
grant select on table public.company_facts to authenticated;   -- read only; the server writes
grant all on table public.company_facts to service_role;

alter table public.company_facts enable row level security;
drop policy if exists company_facts_select on public.company_facts;
create policy company_facts_select on public.company_facts
  for select to authenticated
  using (company_id = public.auth_company_id());

-- ---------------------------------------------------------------------------
-- 4. The ledger learns the new task
-- ---------------------------------------------------------------------------
alter table public.ai_calls drop constraint if exists ai_calls_task_check;
alter table public.ai_calls add constraint ai_calls_task_check
  check (task = any (array['research', 'checklist', 'substeps', 'convert', 'summarise', 'gate',
                           'critique', 'audit', 'document_review', 'document_scan',
                           'document_draft', 'other']));

-- ---------------------------------------------------------------------------
-- VERIFY, by trying to break each one.
-- ---------------------------------------------------------------------------
do $$
declare
  co uuid; doc uuid; sc uuid; gap uuid; cl uuid; fp uuid; tp uuid; n int;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 050: no company on this database, probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-050-probe.pdf', 'probe/050', 'application/pdf', 1, 'upload', 'read')
    returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, is_current)
    values (doc, co, 'program', 'gaps_found', true) returning id into sc;
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title)
    values (sc, doc, co, 1, 'probe gap') returning id into gap;

  -- 1. a checklist can name its document and its gap
  insert into public.checklists (company_id, title, question, document_id, document_gap_id)
    values (co, 'probe checklist', 'from a gap', doc, gap) returning id into cl;
  insert into public.checklist_items (checklist_id, company_id, name, category, origin)
    values (cl, co, 'probe item', 'must_do', 'document');
  -- ...and origin still refuses a value nobody defined
  begin
    insert into public.checklist_items (checklist_id, company_id, name, category, origin)
      values (cl, co, 'probe item', 'must_do', 'scan');
    raise exception 'MIGRATION 050 FAILED: checklist_items.origin accepted "scan".';
  exception when check_violation then null; end;
  -- ...and the two older values still work, because the old path must not break
  insert into public.checklist_items (checklist_id, company_id, name, category, origin)
    values (cl, co, 'probe item', 'must_do', 'conversation');
  insert into public.checklist_items (checklist_id, company_id, name, category, origin)
    values (cl, co, 'probe item', 'must_do', 'added');

  -- *** THE ONE THAT MATTERS: deleting the document must NOT take the checklist. ***
  -- A person can be a fortnight into working through it.
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title)
    values (sc, doc, co, 2, 'probe gap 2');

  -- 2. a draft lives on the gap
  update public.document_gaps
     set draft_text = 'A draft of the missing section.', draft_created_at = now()
   where id = gap;
  if (select draft_text from public.document_gaps where id = gap) is null then
    raise exception 'MIGRATION 050 FAILED: the draft did not store.';
  end if;

  -- 3. company_facts: one answer per key, and a second confirmation replaces it
  insert into public.topics (company_id, title) values (co, 'migration-050-probe') returning id into tp;
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value)
    values (co, tp, 'pcqi_name', 'Dana Whitfield') returning id into fp;
  insert into public.company_facts (company_id, key, value, basis, source_document_id, source_proposal_id)
    values (co, 'pcqi_name', '"Dana Whitfield"'::jsonb, 'read', doc, fp);
  begin
    insert into public.company_facts (company_id, key, value)
      values (co, 'pcqi_name', '"Somebody Else"'::jsonb);
    raise exception 'MIGRATION 050 FAILED: two rows for one company and key were accepted.';
  exception when unique_violation then null; end;
  -- ...and the upsert a route would do does replace it
  insert into public.company_facts (company_id, key, value)
    values (co, 'pcqi_name', '"Somebody Else"'::jsonb)
    on conflict (company_id, key) do update set value = excluded.value, confirmed_at = now();
  if (select value #>> '{}' from public.company_facts where company_id = co and key = 'pcqi_name')
     <> 'Somebody Else' then
    raise exception 'MIGRATION 050 FAILED: the newer confirmation did not replace the older.';
  end if;
  -- basis refuses a plausible third value
  begin
    insert into public.company_facts (company_id, key, value, basis)
      values (co, 'probe_basis', '"x"'::jsonb, 'assumed');
    raise exception 'MIGRATION 050 FAILED: company_facts.basis accepted "assumed".';
  exception when check_violation then null; end;

  -- 4. the ledger takes the new task and still refuses an unknown one
  insert into public.ai_calls (task, model) values ('document_draft', 'migration-050-probe');
  begin
    insert into public.ai_calls (task, model) values ('document_drafting', 'migration-050-probe');
    raise exception 'MIGRATION 050 FAILED: ai_calls.task accepted "document_drafting".';
  exception when check_violation then null; end;
  delete from public.ai_calls where model = 'migration-050-probe';

  -- THE CHECKLIST SURVIVES THE DOCUMENT.
  delete from public.documents where id = doc;
  select count(*) into n from public.checklists where id = cl;
  if n <> 1 then
    raise exception 'MIGRATION 050 FAILED: deleting the document took the checklist with it.';
  end if;
  if (select document_id from public.checklists where id = cl) is not null then
    raise exception 'MIGRATION 050 FAILED: the checklist kept a link to a deleted document.';
  end if;
  -- THREE, not four: four inserts were attempted and the `origin = 'scan'` one was refused by
  -- the CHECK, which is the probe above doing its job.
  select count(*) into n from public.checklist_items where checklist_id = cl;
  if n <> 3 then
    raise exception 'MIGRATION 050 FAILED: the checklist kept % items, wanted 3.', n;
  end if;

  delete from public.checklists where id = cl;
  delete from public.topics where id = tp;
  delete from public.company_facts where company_id = co and key in ('pcqi_name', 'probe_basis');
  raise notice 'MIGRATION 050: a checklist outlives its document, a draft lives on its gap, and one fact per key.';
end $$;

-- ...and the write side is the server's alone. Read it back rather than trusting the grant list.
do $$
declare n int;
begin
  if has_table_privilege('authenticated', 'public.company_facts', 'INSERT')
     or has_table_privilege('authenticated', 'public.company_facts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.company_facts', 'DELETE') then
    raise exception 'MIGRATION 050 FAILED: authenticated can write company_facts — a confirmed fact is the product''s record of what a person told us.';
  end if;
  if not has_table_privilege('authenticated', 'public.company_facts', 'SELECT') then
    raise exception 'MIGRATION 050 FAILED: company members cannot read their own confirmed facts.';
  end if;
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'company_facts' and grantee = 'anon';
  if n > 0 then
    raise exception 'MIGRATION 050 FAILED: anon holds % grant(s) on company_facts.', n;
  end if;
  raise notice 'MIGRATION 050: members read company_facts, nobody but the server writes, anon holds nothing.';
end $$;

commit;
