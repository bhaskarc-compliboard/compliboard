-- =================================================================================================
-- 091 — EACH CHAT SECTION IS ITS OWN: TWO NEW WORDS, IN THE TWO PLACES THAT POLICE THEM.
-- =================================================================================================
--
-- WHY.
--
-- `docs/GAPS-PLAN.md` decision 11: *"Each chat is billed and modelled as itself."* The shared chat
-- engine (`lib/ask/`) had two sections written into it as literals — `brief.section === 'calendar'
-- ? 'calendar' : 'hr'`, twice — so any third section's answers would have run on HR's model tier
-- and been billed to HR's ledger word. Part A step 1 replaces that with one lookup per section, and
-- the lookup needs two words the database does not yet accept:
--
--   1. `ai_calls_task_check` gains `documents` and `audits_chat`, so a cost row can say which
--      section's chat spent the money. Without this, a Documents answer's ledger row is refused by
--      the CHECK and swallowed by `recordAICall`'s catch — the answer arrives, the money is spent,
--      and nothing records it. That is the failure `DECISIONS.md` §128 J exists to prevent.
--
--   2. `topics_section_is_known` gains the same two, so a conversation can belong to those
--      sections. Without this, the engine's very first INSERT for a Documents question fails the
--      CHECK, and `lib/ask/engine.ts` is written to carry on without a conversation rather than
--      lose the answer — so the person would get an answer that was never saved, every time, with
--      only a line in the server log to say why.
--
-- *** `audits_chat`, NOT `audit`. *** `audit` is already a ledger word, and it is the agency audit:
-- one long reasoning call over a filing cabinet. The argument for spending more on that is not the
-- argument for a chat answer, and a ledger that cannot tell them apart cannot answer the one
-- question it was built to answer. `lib/ai.ts`'s `audit` tier carries the same note.
--
-- *** NOTHING WRITES EITHER WORD YET, AND THAT IS DELIBERATE. *** Part A steps 4 and 6 build the two
-- chats. The words are added now because the engine, the TypeScript unions, the ledger and the night
-- summary all have to agree on them in the same commit; a schema that trails the code by one step is
-- how migration 007 broke signup in production with a green build (`CLAUDE.md` §3.6).
--
-- ADDITIVE, AND IT CREATES NO TABLE. Two CHECK constraints are dropped and recreated with every
-- prior value restated and two added, so every existing row stays valid and nothing that was
-- refused before is accepted now except those two words. **No REVOKE or GRANT is touched** — §3.6's
-- revoke-then-grant rule is about a table being created, and this migration creates none.
--
-- THE PRIOR VALUES ARE READ FROM THE CATALOG ON STAGING, NOT FROM THE PRIOR MIGRATION FILE
-- (`CLAUDE.md` §3.7). Read on 2 November 2026 with
-- `select pg_get_constraintdef(oid) from pg_constraint where conname = ...`:
--
--   ai_calls_task_check      CHECK ((task = ANY (ARRAY['research', 'checklist', 'substeps',
--                              'convert', 'summarise', 'gate', 'critique', 'audit',
--                              'document_review', 'document_scan', 'document_draft', 'howto',
--                              'other', 'hr', 'hr_check', 'calendar', 'website'])))   -- 17
--   topics_section_is_known  CHECK ((section = ANY (ARRAY['workspace', 'hr', 'calendar'])))   -- 3
--
-- =================================================================================================

begin;

-- =================================================================================================
-- 1. THE LEDGER LEARNS TWO WORDS.
--
-- `ai_calls_task_check` — 17 values, plus `documents` and `audits_chat`. Owned by 040, then 050,
-- then 064, then 066, then 073, then 085; owned by this file now. Every prior value restated.
-- `lib/costLedger.ts` `LEDGER_TASKS` must match, and `tests/unit/costLedger.test.ts` reads THIS
-- FILE and asserts that it does.
-- =================================================================================================

alter table public.ai_calls drop constraint if exists ai_calls_task_check;
alter table public.ai_calls add constraint ai_calls_task_check check (task in (
  'research', 'checklist', 'substeps', 'convert', 'summarise',
  'gate', 'critique', 'audit', 'document_review', 'document_scan', 'document_draft', 'howto',
  'other', 'hr', 'hr_check',
  'calendar',
  'website',
  'documents',
  'audits_chat'
));


-- =================================================================================================
-- 2. A CONVERSATION MAY BELONG TO TWO MORE SECTIONS.
--
-- `topics_section_is_known` — 3 values, plus `documents` and `audits_chat`. Owned by 066:246–247,
-- then 073:473–475; owned by this file now. `lib/topicList.ts`'s `TOPIC_SECTIONS` carries the same
-- list and its `TopicSection` type is read off it, so the two cannot drift; `readTopicList` is
-- still the ONE place a section is filtered on.
--
-- 066's default is untouched: a topic inserted with no section is still a workspace one, which is
-- what `app/api/chat/route.ts` relies on.
-- =================================================================================================

alter table public.topics drop constraint if exists topics_section_is_known;
alter table public.topics add constraint topics_section_is_known
  check (section in ('workspace', 'hr', 'calendar', 'documents', 'audits_chat'));


-- =================================================================================================
-- 3. THE SELF-TEST.
--
-- It reads both constraints back out of the catalog and refuses if either is missing a word — so
-- "the migration ran" is taken from the database and not from this file having been executed. Then
-- it tries the two writes that matter and the two that must still be refused, because a CHECK
-- nobody has tried to break is a comment (`CLAUDE.md` §3.7).
--
-- Every failure raises, which rolls the whole migration back.
-- =================================================================================================

do $$
declare
  def   text;
  w     text;
  co    uuid;
  n     bigint;
  ok    boolean;
begin
  -- ---- 1. BOTH CONSTRAINTS EXIST, AND EACH HOLDS EVERY WORD IT SHOULD. ----
  select pg_get_constraintdef(oid) into def from pg_constraint where conname = 'ai_calls_task_check';
  if def is null then
    raise exception 'MIGRATION 091 FAILED: ai_calls_task_check does not exist.';
  end if;
  foreach w in array array['research', 'checklist', 'substeps', 'convert', 'summarise',
                           'gate', 'critique', 'audit', 'document_review', 'document_scan',
                           'document_draft', 'howto', 'other', 'hr', 'hr_check', 'calendar',
                           'website', 'documents', 'audits_chat'] loop
    if position('''' || w || '''' in def) = 0 then
      raise exception 'MIGRATION 091 FAILED: ai_calls_task_check does not allow %. Definition: %', w, def;
    end if;
  end loop;

  select pg_get_constraintdef(oid) into def from pg_constraint where conname = 'topics_section_is_known';
  if def is null then
    raise exception 'MIGRATION 091 FAILED: topics_section_is_known does not exist.';
  end if;
  foreach w in array array['workspace', 'hr', 'calendar', 'documents', 'audits_chat'] loop
    if position('''' || w || '''' in def) = 0 then
      raise exception 'MIGRATION 091 FAILED: topics_section_is_known does not allow %. Definition: %', w, def;
    end if;
  end loop;

  -- ---- 2. A COMPANY TO HANG THE PROBES ON. ----
  insert into public.companies (name) values ('091 probe company') returning id into co;

  -- ---- 3. THE TWO NEW SECTIONS ARE ACCEPTED, AND READ BACK. ----
  -- *** THE PRESENCE IS PROVED BEFORE THE ABSENCE IS CLAIMED *** (§9a). The refusal below is only
  -- meaningful because these two writes succeed first.
  foreach w in array array['documents', 'audits_chat'] loop
    insert into public.topics (company_id, title, section) values (co, '091 probe ' || w, w);
    select count(*) into n from public.topics where company_id = co and section = w;
    if n <> 1 then
      raise exception 'MIGRATION 091 FAILED: a topic with section % did not read back (% rows).', w, n;
    end if;
  end loop;

  -- ---- 4. AND A WORD NOBODY DEFINED IS STILL REFUSED. ----
  begin
    insert into public.topics (company_id, title, section) values (co, '091 probe bad', 'document');
    raise exception 'MIGRATION 091 FAILED: topics accepted the section "document", so the CHECK decides nothing.';
  exception when check_violation then null;
  end;

  -- ---- 5. 066's DEFAULT IS UNTOUCHED: NO SECTION STILL MEANS THE WORKSPACE. ----
  insert into public.topics (company_id, title) values (co, '091 probe default');
  if (select section from public.topics where company_id = co and title = '091 probe default') <> 'workspace' then
    raise exception 'MIGRATION 091 FAILED: a topic with no section is no longer a workspace one.';
  end if;

  -- ---- 6. THE LEDGER ACCEPTS BOTH NEW WORDS. ----
  foreach w in array array['documents', 'audits_chat'] loop
    insert into public.ai_calls (company_id, task, model, input_tokens, output_tokens, searches)
      values (co, w, 'claude-haiku-4-5', 1, 1, 0);
    select count(*) into n from public.ai_calls where company_id = co and task = w;
    if n <> 1 then
      raise exception 'MIGRATION 091 FAILED: an ai_calls row with task % did not read back (% rows).', w, n;
    end if;
  end loop;

  -- ---- 7. AND STILL REFUSES ONE NOBODY DEFINED. ----
  begin
    insert into public.ai_calls (company_id, task, model, input_tokens, output_tokens, searches)
      values (co, 'audits', 'claude-haiku-4-5', 1, 1, 0);
    raise exception 'MIGRATION 091 FAILED: ai_calls accepted the task "audits", so the CHECK decides nothing.';
  exception when check_violation then null;
  end;

  -- ---- 8. EVERY WORD THAT WORKED BEFORE STILL WORKS. ----
  -- Restating a list is where a value gets lost, so one of the originals is written too.
  insert into public.ai_calls (company_id, task, model, input_tokens, output_tokens, searches)
    values (co, 'research', 'claude-haiku-4-5', 1, 1, 0);
  insert into public.topics (company_id, title, section) values (co, '091 probe hr', 'hr');
  select count(*) = 1 into ok from public.topics where company_id = co and section = 'hr';
  if not ok then
    raise exception 'MIGRATION 091 FAILED: the section "hr" stopped working when the list was restated.';
  end if;

  -- ---- 9. CLEAN UP, AND PROVE IT. ----
  -- Both tables cascade on the company (`ai_calls_company_id_fkey` and the topics key, both
  -- ON DELETE CASCADE, read from pg_constraint on staging on 2 November). Checked rather than
  -- trusted, because this migration writes probe rows into two tenant tables on a live staging
  -- database and a probe that outlives its probe is somebody else's confusing row later.
  delete from public.companies where id = co;
  select count(*) into n from public.topics where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 091 FAILED: % probe topic(s) outlived the probe company.', n;
  end if;
  select count(*) into n from public.ai_calls where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 091 FAILED: % probe ledger row(s) outlived the probe company.', n;
  end if;

  raise notice 'MIGRATION 091 OK: ai_calls_task_check holds 19 words and topics_section_is_known '
    'holds 5, both read back from the catalog; documents and audits_chat are accepted on both '
    'tables and read back; a word nobody defined is still refused on both; a topic with no section '
    'is still a workspace one; research and hr still work after the restatement; and every probe '
    'row in both tables went with its company.';
end $$;

commit;
