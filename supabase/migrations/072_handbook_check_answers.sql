-- ===========================================================================
-- 072 — A HANDBOOK CHECK PIECE STORES AN HR ANSWER (HR Baseline Step 1, the owner, 8 October 2026)
-- ===========================================================================
-- WHY. Rev 1 is Opus 5.5 at full power, unrestricted; improvements come later as switches. So a handbook check is
-- no longer a structured prompt with words and findings: each piece is THE SAME CALL AS AN HR ANSWER — the pure
-- prompt, the company context, the piece's sections, web search with no limit — and what it stores is that
-- answer, as the answer route stores one on `turns`: its text, its sources, and its check record.
--
-- WHAT IT ADDS. Three nullable columns on `handbook_check_sections`, written only by the server
-- (`lib/handbookCheck.ts` runPiece) on the piece's first row; the other rows of the same piece carry none:
--   answer_text     the answer, with its closing lines (quotes marked, links not shown), as a person reads it
--   answer_sources  its numbered sources — handbook cards and web pages — exactly as an answer's `turns.sources`
--   check_record    what the answer was given and how its quotes and links were checked (`lib/hrAnswer.ts` checkRecord)
-- Every existing row stays NULL: the structured checks before 8 October keep their `word` and their
-- `handbook_findings` rows, readable as before. Nothing is removed.
--
-- WHO MAY DO WHAT: unchanged — a person reads these rows (066 grants SELECT on the table) and writes none.
-- Table grants cover new columns; the verify block reads that back. Two CHECKs: an answer is never stored empty,
-- and sources are always a list — each tested by violating it, ON PROBE ROWS OF ITS OWN (the 070 rule,
-- DECISIONS.md §171), so the block proves the same on production's empty table. The probe is removed.
-- ===========================================================================

begin;

alter table public.handbook_check_sections add column if not exists answer_text    text;
alter table public.handbook_check_sections add column if not exists answer_sources jsonb;
alter table public.handbook_check_sections add column if not exists check_record   jsonb;

alter table public.handbook_check_sections drop constraint if exists handbook_check_sections_answer_not_empty;
alter table public.handbook_check_sections add constraint handbook_check_sections_answer_not_empty
  check (answer_text is null or length(btrim(answer_text)) > 0);

alter table public.handbook_check_sections drop constraint if exists handbook_check_sections_sources_are_a_list;
alter table public.handbook_check_sections add constraint handbook_check_sections_sources_are_a_list
  check (answer_sources is null or jsonb_typeof(answer_sources) = 'array');

comment on column public.handbook_check_sections.answer_text is
  'Since 8 October 2026: the piece''s HR answer, as a person reads it. On the piece''s first row only.';
comment on column public.handbook_check_sections.answer_sources is 'The answer''s numbered sources (handbook cards and web pages).';
comment on column public.handbook_check_sections.check_record is 'How the answer''s quotes and links were checked (lib/hrAnswer.ts checkRecord).';

-- ===========================================================================
-- VERIFY. Raises unless every line holds; read back, never taken from the statements above.
-- ===========================================================================
do $$
declare n int; c text; refused boolean; co uuid; hb uuid; sec uuid; ck uuid; r1 uuid;
begin
  select count(*) into n from information_schema.columns where table_schema = 'public' and table_name = 'handbook_check_sections'
     and ((column_name = 'answer_text' and data_type = 'text') or (column_name in ('answer_sources', 'check_record') and data_type = 'jsonb'))
     and is_nullable = 'YES';
  if n <> 3 then raise exception 'MIGRATION 072 FAILED: expected 3 nullable answer columns, found %.', n; end if;

  -- a person reads them and writes none; anon nothing
  for c in select unnest(array['answer_text', 'answer_sources', 'check_record']) loop
    if not has_column_privilege('authenticated', 'public.handbook_check_sections', c, 'SELECT') then
      raise exception 'MIGRATION 072 FAILED: authenticated cannot read handbook_check_sections.%.', c;
    end if;
    if has_column_privilege('authenticated', 'public.handbook_check_sections', c, 'INSERT')
       or has_column_privilege('authenticated', 'public.handbook_check_sections', c, 'UPDATE')
       or has_column_privilege('anon', 'public.handbook_check_sections', c, 'SELECT') then
      raise exception 'MIGRATION 072 FAILED: handbook_check_sections.% is writable by a person or readable by anon.', c;
    end if;
  end loop;
  -- ...and that check can see a presence: the same question about `status`, a column 066 covers
  if not has_column_privilege('authenticated', 'public.handbook_check_sections', 'status', 'SELECT') then
    raise exception 'MIGRATION 072 FAILED: the privilege check sees nothing on handbook_check_sections.status either.';
  end if;

  -- every existing row is NULL: nothing was backfilled (checked before the probe below writes its own)
  select count(*) into n from public.handbook_check_sections where answer_text is not null or answer_sources is not null or check_record is not null;
  if n <> 0 then raise exception 'MIGRATION 072 FAILED: % existing row(s) carry an answer.', n; end if;

  -- ---- THE RULES, ON PROBE ROWS OF THEIR OWN ----
  insert into public.companies (name, industry, state) values ('Migration 072 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.handbooks (company_id, name, file_path, file_name, status)
    values (co, 'Migration 072 probe', co || '/handbooks/probe-072.pdf', 'probe-072.pdf', 'read') returning id into hb;
  insert into public.handbook_sections (handbook_id, company_id, position, title, text, text_sha256)
    values (hb, co, 0, 'Probe', 'probe text', 'probe') returning id into sec;
  insert into public.handbook_checks (handbook_id, company_id, reason) values (hb, co, 'on_demand') returning id into ck;
  insert into public.handbook_check_sections (check_id, company_id, kind, section_id) values (ck, co, 'section', sec) returning id into r1;

  -- a stored answer reads back (a presence)
  update public.handbook_check_sections set status = 'done',
    answer_text = 'Probe answer.', answer_sources = '[{"n":1,"kind":"web","title":"t","url":"https://example.gov"}]'::jsonb,
    check_record = '{"version":2}'::jsonb where id = r1;
  select count(*) into n from public.handbook_check_sections where id = r1 and answer_text = 'Probe answer.'
     and jsonb_array_length(answer_sources) = 1 and check_record ->> 'version' = '2';
  if n <> 1 then raise exception 'MIGRATION 072 FAILED: an answer did not save on the probe, so the refusals below would prove nothing.'; end if;

  refused := false;
  begin update public.handbook_check_sections set answer_text = '   ' where id = r1;
  exception when check_violation then refused := true; end;
  if not refused then raise exception 'MIGRATION 072 FAILED: an empty answer was accepted.'; end if;

  refused := false;
  begin update public.handbook_check_sections set answer_sources = '{"n":1}'::jsonb where id = r1;
  exception when check_violation then refused := true; end;
  if not refused then raise exception 'MIGRATION 072 FAILED: sources that are not a list were accepted.'; end if;

  -- a row with no answer at all is still accepted (the other rows of a piece, and every check before 8 October)
  update public.handbook_check_sections set answer_text = null, answer_sources = null, check_record = null where id = r1;

  delete from public.companies where id = co;
  select (select count(*) from public.handbooks where id = hb) + (select count(*) from public.handbook_check_sections where company_id = co) into n;
  if n <> 0 then raise exception 'MIGRATION 072 FAILED: % probe row(s) were not removed.', n; end if;

  raise notice 'MIGRATION 072 VERIFIED: answer_text, answer_sources, check_record — nullable, read-only to a person, nothing to anon; every existing row NULL; on probe rows of its own an answer saved and read back, an empty answer and sources that are not a list refused, a row with no answer accepted; the probe removed.';
end $$;

commit;
