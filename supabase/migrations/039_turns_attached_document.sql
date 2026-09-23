-- ============================================================
-- COMPLIBOARD — MIGRATION 039: A TURN REMEMBERS THE FILE THAT WAS ATTACHED TO IT
-- ============================================================
--
-- *** THE DEFECT THIS EXISTS TO CLOSE. ***
--
-- On production the owner attached a policy PDF in a research conversation. The file card
-- rendered, the `documents` row was written, the review ran, the Documents screen showed the
-- full scan — and then the next question got *"no file has come through"*, because **nothing
-- connected the attachment to the conversation**.
--
-- The old page sent the file WITH the question, as multipart, in the same `/api/chat` call
-- (`app/compliance/page.tsx` before commit a5587af). The rebuilt page uploads it and stops.
-- The route still knows what to do with a file; nothing was sending one.
--
-- Sending it again is half the fix. The other half is here: **a conversation has to remember
-- that a document is part of it**, or the attachment is lost on the next turn, on reload, and to
-- the summariser.
--
-- ------------------------------------------------------------
-- WHY TWO COLUMNS AND NOT ONE
--
-- `document_id` is the link. `document_name` is a COPY of the name, and copying it is
-- deliberate rather than lazy denormalisation:
--
--   > ### A TRANSCRIPT MUST STILL READ CORRECTLY AFTER THE DOCUMENT IS DELETED.
--   > "You attached Harbor-Kitchen-Employee-Policy-2026.pdf and I found seven problems in it"
--   > is a true statement about what happened in that conversation, and it stays true after the
--   > file is removed from Documents. With only a foreign key, deleting the document would
--   > silently rewrite history to "you attached nothing".
--
-- Hence `ON DELETE SET NULL` rather than CASCADE: deleting a document must not delete the
-- conversation turn that discussed it. The id goes; the name stays; the turn survives.
-- ------------------------------------------------------------
--
-- ADDITIVE. Two nullable columns and an index. No column is dropped, altered or renamed, and
-- every existing row is valid with both NULL — which is exactly what a turn with no attachment
-- is. Safe to apply to production ahead of the code.

alter table public.turns
  add column if not exists document_id uuid references public.documents(id) on delete set null;

alter table public.turns
  add column if not exists document_name text;

comment on column public.turns.document_id is
  'The document attached to this turn, if any. ON DELETE SET NULL: removing a document must '
  'not remove the conversation turn about it. Migration 039.';
comment on column public.turns.document_name is
  'A COPY of the name at the time of the attach, so the transcript still reads correctly after '
  'the document is deleted and document_id becomes NULL. Migration 039.';

-- Company-leading is the convention, but the only question asked of this column is
-- "does this topic have an attachment", so the topic leads.
create index if not exists idx_turns_topic_document
  on public.turns (topic_id, document_id)
  where document_id is not null;

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare
  n int;
  rule text;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'turns'
     and column_name in ('document_id', 'document_name');
  if n <> 2 then
    raise exception 'MIGRATION 039 FAILED: expected both columns on turns, found %.', n;
  end if;

  -- *** THE DELETE RULE IS READ, NOT ASSUMED. *** `c` would be CASCADE and would mean deleting
  -- a document erases the conversation that discussed it.
  select confdeltype into rule from pg_constraint
   where conrelid = 'public.turns'::regclass and contype = 'f'
     and conname like '%document_id%';
  if rule is null then
    raise exception 'MIGRATION 039 FAILED: no foreign key on turns.document_id.';
  end if;
  if rule <> 'n' then
    raise exception 'MIGRATION 039 FAILED: turns.document_id deletes with rule %, expected n (SET NULL). A document delete would take the conversation with it.', rule;
  end if;

  -- Both must be NULLABLE: a turn with no attachment is the normal case, and every row that
  -- already exists is one.
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'turns'
     and column_name in ('document_id', 'document_name') and is_nullable = 'YES';
  if n <> 2 then
    raise exception 'MIGRATION 039 FAILED: a new column is NOT NULL; every existing turn would be invalid.';
  end if;

  -- No grant changes: `turns` already carries its own, and adding a column does not alter them.
  -- Checked rather than assumed, because a table whose grants quietly changed is §3.6's warning.
  if has_table_privilege('anon', 'public.turns', 'SELECT') then
    raise exception 'MIGRATION 039 FAILED: anon can SELECT turns.';
  end if;

  raise notice 'MIGRATION 039 OK: turns.document_id (ON DELETE SET NULL) and turns.document_name added, both nullable, anon still closed.';
end $$;
