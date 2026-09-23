-- ============================================================
-- COMPLIBOARD — MIGRATION 031: CONVERSATIONS THAT SURVIVE THE PAGE
-- ============================================================
--
-- WHY. Until now a conversation lived for the length of the browser tab. `topics` recorded that
-- one had happened; nothing recorded what was said. Reloading lost it, and the nightly reader
-- §108 describes had nothing to read.
--
-- This adds the transcript — `turns` — and the six timestamps a topic needs to have a lifecycle:
-- when it went idle, when it was summarised and by whom, when facts were read out of it, when it
-- may be cleared, and when it was last spoken to.
--
-- *** NO CONTENT IN THIS MIGRATION. *** §118: a migration changes the SHAPE of the library, never
-- its content. Nothing here inserts a row.
--
-- ------------------------------------------------------------
-- RETENTION, AND THE NUMBER THAT CHANGED
--
-- §110 set fifteen days. **It is seven days after summarising**, decided 22 September and
-- recorded in §125. The clock no longer starts when the conversation happens — it starts when
-- the summary exists, because the summary is what makes the transcript disposable.
--
-- Two columns carry that, and the separation is the point:
--   `summarised_at`  the summary exists
--   `delete_after`   the transcript may go — set to summarised_at + 7 days by the nightly job
--
-- A single "expires_at" would conflate them, and a summariser outage would then either delete
-- transcripts that were never summarised or keep them forever. Both halves are visible instead.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 1. THE TRANSCRIPT
-- ------------------------------------------------------------
create table if not exists public.turns (
  id             uuid primary key default gen_random_uuid(),
  topic_id       uuid not null references public.topics(id) on delete cascade,
  -- TENANCY THE SAME TWO WAYS AS EVERY OTHER TABLE (CLAUDE.md §3.6): a `company_id` column,
  -- and RLS through `public.auth_company_id()`. `topic_id` alone would make every policy a
  -- join, and a join in a policy is a policy nobody reads twice.
  company_id     uuid not null references public.companies(id) on delete cascade,
  -- Position within the conversation, 1-based. Not a timestamp: two turns written in the same
  -- millisecond must still have an order, and "the third thing said" is what the reader means.
  position       integer not null,
  role           text not null check (role in ('user', 'assistant')),
  text           text not null,
  -- The assistant's citations for THIS turn, in the shape `lib/ai.ts` returns: [{n,title,url}].
  -- Per turn because each answer cites its own (§106) — a conversation-level list would make
  -- "[3]" in the second answer point at the third source of the fifth.
  sources        jsonb,
  -- A stopped answer is not a question answered (Run 2's standing decision). The user's turn is
  -- saved and flagged; NO assistant row is written, because there is no answer to keep.
  stopped        boolean not null default false,
  created_at     timestamptz not null default now()
);

comment on table public.turns is
  'One message in a conversation. Cleared 7 days after the topic is summarised (DECISIONS.md '
  '§125, superseding §110''s 15 days); the topic row and its summary survive.';
comment on column public.turns.position is
  '1-based order within the topic. Not derived from created_at — two turns can share a millisecond.';
comment on column public.turns.stopped is
  'The user stopped this answer. Set on the USER turn; no assistant row exists for it.';

-- One row per position per topic. Without this a double-submit writes two turn 3s and the
-- transcript reads as though the person said the same thing twice.
create unique index if not exists idx_turns_topic_position on public.turns (topic_id, position);
-- Company-leading, per §3.7's column conventions.
create index if not exists idx_turns_company_created on public.turns (company_id, created_at desc);
create index if not exists idx_turns_topic on public.turns (topic_id, position);

-- ------------------------------------------------------------
-- 2. THE TOPIC'S LIFECYCLE
--
-- All six nullable, all added rather than replacing anything. A topic written before today has
-- NULL in every one of them, which reads correctly: never idle, never summarised, never
-- scheduled for deletion. The nightly jobs pick them up on their own terms.
-- ------------------------------------------------------------
alter table public.topics add column if not exists idle_at        timestamptz;
alter table public.topics add column if not exists summarised_at  timestamptz;
alter table public.topics add column if not exists summary_source text;
alter table public.topics add column if not exists extracted_at   timestamptz;
alter table public.topics add column if not exists delete_after   timestamptz;
alter table public.topics add column if not exists last_turn_at   timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'topics_summary_source_is_known') then
    alter table public.topics add constraint topics_summary_source_is_known
      check (summary_source is null or summary_source in ('user', 'nightly'));
  end if;
end $$;

comment on column public.topics.summary_source is
  'Who wrote the summary. The nightly job never overwrites a user summary unless turns are '
  'newer than summarised_at — DECISIONS.md §125.';
comment on column public.topics.delete_after is
  'When the TRANSCRIPT may be cleared. Set by the summariser to summarised_at + 7 days. Cleared '
  'by any new turn: an active conversation is never deleted under someone.';
comment on column public.topics.last_turn_at is
  'The most recent turn. Drives both the 24h idle test and the 30-day backstop.';

-- The summariser asks "which topics are idle and unsummarised", the deleter asks "which are due".
create index if not exists idx_topics_last_turn on public.topics (last_turn_at) where last_turn_at is not null;
create index if not exists idx_topics_delete_after on public.topics (delete_after) where delete_after is not null;

-- ------------------------------------------------------------
-- 3. GRANTS — REVOKE FIRST, BOTH ROLES. CLAUDE.md §3.6.
--
-- This project carries default privileges on `public`: `anon` and `authenticated` hold full DML
-- on any new table BEFORE a single GRANT runs. A grant list describes what you added, not what
-- the role holds. Found twice — migration 008 for anon, migration 028 for authenticated, the
-- second by a verify block refusing three granted privileges over a fourth never granted.
--
-- NO DELETE for `authenticated`, and it is load-bearing: a transcript is cleared by the nightly
-- deleter under the service role, on a schedule the customer was told about. A user deleting
-- individual turns would leave a conversation that reads as though it never contained what it
-- contained — and the summary, which is kept, would then disagree with it.
-- ------------------------------------------------------------
revoke all on table public.turns from anon;
revoke all on table public.turns from authenticated;
grant select, insert on table public.turns to authenticated;
grant all on table public.turns to service_role;

alter table public.turns enable row level security;

drop policy if exists turns_select_own_company on public.turns;
create policy turns_select_own_company on public.turns
  for select to authenticated
  using (public.turns.company_id = public.auth_company_id());

drop policy if exists turns_insert_own_company on public.turns;
create policy turns_insert_own_company on public.turns
  for insert to authenticated
  with check (public.turns.company_id = public.auth_company_id());

-- ------------------------------------------------------------
-- 4. VERIFY — read what the roles HOLD, never the grant list above.
-- ------------------------------------------------------------
do $$
declare
  n int;
  v text;
  probe uuid;
begin
  -- anon holds nothing.
  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.turns', v) then
      raise exception 'MIGRATION 031 FAILED: anon holds % on turns. The default ACL was not revoked.', v;
    end if;
  end loop;

  -- authenticated holds exactly SELECT and INSERT — and NOT DELETE, which is the point.
  if not has_table_privilege('authenticated', 'public.turns', 'SELECT')
     or not has_table_privilege('authenticated', 'public.turns', 'INSERT') then
    raise exception 'MIGRATION 031 FAILED: authenticated cannot read or write turns.';
  end if;
  foreach v in array array['UPDATE', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.turns', v) then
      raise exception 'MIGRATION 031 FAILED: authenticated holds % on turns, which was never granted.', v;
    end if;
  end loop;

  select count(*) into n from pg_policies where schemaname='public' and tablename='turns';
  if n <> 2 then
    raise exception 'MIGRATION 031 FAILED: expected 2 policies on turns, found %.', n;
  end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='topics'
     and column_name in ('idle_at','summarised_at','summary_source','extracted_at','delete_after','last_turn_at');
  if n <> 6 then
    raise exception 'MIGRATION 031 FAILED: expected 6 lifecycle columns on topics, found %.', n;
  end if;

  -- THE CHECK CONSTRAINT IS TESTED BY VIOLATING IT. §3.7: a constraint nobody has tried to
  -- break is a comment.
  --
  -- *** THE GUARD BELOW EXISTS BECAUSE THE FIRST VERSION FAILED THE FROM-ZERO RESTORE. ***
  -- It probed with `insert ... select id from public.companies limit 1`, which on an EMPTY
  -- database inserts ZERO ROWS — and a zero-row insert raises nothing at all. So the probe
  -- "succeeded", control fell through to the failure `raise` below it, and migration 031
  -- refused itself on a fresh chain while passing on a populated one.
  --
  -- That is §98's own argument arriving at this migration: applying incrementally proves a
  -- migration worked once, from one starting state. The empty database is a different state,
  -- and it is the one the chain has to build from.
  select id into probe from public.companies limit 1;
  if probe is not null then
    begin
      insert into public.topics (company_id, title, summary_source)
      values (probe, '__mig031_probe__', 'nightly-ish');
      raise exception 'MIGRATION 031 FAILED: summary_source accepted a value outside (user, nightly).';
    exception when check_violation then null;
    end;
    delete from public.topics where title = '__mig031_probe__';
  else
    -- A fresh chain has no company to hang a topic off. The constraint is still asserted to
    -- EXIST, which is the half that can be checked without a row.
    if not exists (select 1 from pg_constraint where conname = 'topics_summary_source_is_known') then
      raise exception 'MIGRATION 031 FAILED: the summary_source constraint was not created.';
    end if;
  end if;

  raise notice 'MIGRATION 031 OK: turns created (anon 0, authenticated SELECT+INSERT only, 2 policies), 6 lifecycle columns on topics, summary_source constraint refuses an unknown value.';
end $$;
