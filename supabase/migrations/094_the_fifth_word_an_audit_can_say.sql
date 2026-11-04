-- 094 — THE FIFTH WORD AN AUDIT CAN SAY: "ON FILE, GAPS FOUND".
--
-- The owner's decision 47 of 4 November 2026 (`docs/GAPS-PLAN.md` §3), and it comes out of his own
-- walk of 3 November. Four of the ten lines of the Clackamas checklist run came back `on_file`
-- while the sentence underneath them listed what was missing — run
-- `8707eea9-6c58-4c98-ab9d-4ec5825642cd`, lines A3, B2, B3 and B4, read from this database:
--
--   B2  on_file  "It shows only two of them… evaluated within the last three years. Rohan Patel's
--                 three-year evaluation was due by 2 February 2026 and is overdue."
--   A3  on_file  "Nothing separate on file records a review… The gap is the SDSs."
--   B3  on_file  "Two things are missing. First, the line also asks for medical evaluations…"
--   B4  on_file  "The reading found two problems with the log…"
--
-- *** AND THE MODEL WAS RIGHT EVERY TIME. *** `prompts/audit-agency.ts` told it so, in a
-- paragraph headed "ON FILE MEANS A DOCUMENT ANSWERS IT, EVEN IN PART". The audit had no word for
-- "on file, with gaps", so the four greens were the only honest thing it could say — and a person
-- scanning the pills read four greens that were not green. That is the defect: not a wrong
-- answer, a missing word.
--
-- So the word list grows by one, here and in the prompt in the same commit. `on_file` now means
-- a document answers it and NOTHING it shows falls short; `on_file_gaps` means a document answers
-- it and what the document itself shows does not meet what was asked in full. The four old words
-- keep their meanings exactly.
--
-- *** WHY THE CONSTRAINT IS RESTATED WHOLE RATHER THAN WIDENED. *** `word` carries an UNNAMED
-- column-level CHECK from `058_the_audit_as_rows.sql:177`, which Postgres named
-- `audit_findings_word_check` — read back from `pg_constraint` on staging before writing this,
-- not taken from the migration file. There is no `alter … add value` for a CHECK: it is dropped
-- and added, and the new definition is the whole list so the next person reads one statement
-- instead of two.
--
-- NOTHING IS BACKFILLED. Widening a CHECK accepts every row already stored; 425 findings on
-- staging, none of them `word is null` on a `finding`, so no row is stranded by this.
--
-- AND `audit_findings_expected_is_expected` IS DELIBERATELY UNTOUCHED. It reads
-- `kind <> 'expected' or (basis = 'expected' and word = 'nothing_on_file')`, which already does
-- the work decision 60 asks for: a suggestion — something companies like this usually hold and we
-- have not been shown — CANNOT take the fifth word. It stays `nothing_on_file` and is labelled
-- "Usually held — not seen" wherever it is shown. The probe below proves the refusal rather than
-- assuming it: §3.7, a constraint nobody has tried to break is a comment.

begin;

alter table public.audit_findings
  drop constraint if exists audit_findings_word_check;
alter table public.audit_findings
  add constraint audit_findings_word_check check (
    word in ('on_file', 'on_file_gaps', 'stale', 'nothing_on_file', 'not_a_document_question')
  );

comment on column public.audit_findings.word is
  'What the audit says about this line, one of five: on_file (a document answers it and nothing '
  'it shows falls short) · on_file_gaps (a document answers it and what the document shows does '
  'not meet what was asked in full — decision 47) · stale (on file and old enough that an '
  'inspector will ask) · nothing_on_file (nobody has shown us one, which is NOT an accusation) · '
  'not_a_document_question (no document can settle it). null only on a template line nobody '
  'answered, which says so in what_to_do.';

-- ===========================================================================
-- THE PROBE. Three things, and the third is the one worth having: the fifth
-- word goes in, a sixth word is refused, and a suggestion cannot take it.
-- ===========================================================================
do $$
declare
  co uuid; run uuid; sec uuid; ok boolean;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 094: no company on this database, probes skipped.';
    return;
  end if;

  insert into public.audit_runs (company_id, kind, agency_label, status)
    values (co, 'agency', 'migration-094-probe', 'queued') returning id into run;
  insert into public.audit_sections (company_id, run_id, ordinal, title, status)
    values (co, run, 0, 'migration-094-probe', 'queued') returning id into sec;

  -- 1. the fifth word is accepted
  insert into public.audit_findings (company_id, run_id, section_id, ordinal, kind, title, word, basis)
    values (co, run, sec, 0, 'finding', 'probe: on file with gaps', 'on_file_gaps', 'read');

  -- 2. a sixth word is still refused. The list is five, not "five and whatever reads like one".
  ok := false;
  begin
    insert into public.audit_findings (company_id, run_id, section_id, ordinal, kind, title, word, basis)
      values (co, run, sec, 1, 'finding', 'probe: a sixth word', 'on_file_with_gaps', 'read');
  exception when check_violation then ok := true;
  end;
  if not ok then
    raise exception 'MIGRATION 094 FAILED: audit_findings accepted a word outside the five.';
  end if;

  -- 3. AND A SUGGESTION CANNOT TAKE IT — decision 60. An expected row is pinned to
  --    nothing_on_file by 058:209, and that is what keeps suggestions out of the counts.
  ok := false;
  begin
    insert into public.audit_findings (company_id, run_id, section_id, ordinal, kind, title, word, basis)
      values (co, run, sec, 2, 'expected', 'probe: a suggestion', 'on_file_gaps', 'expected');
  exception when check_violation then ok := true;
  end;
  if not ok then
    raise exception 'MIGRATION 094 FAILED: an expected row took the fifth word.';
  end if;

  -- 4. and the four old words still go in, because a restated constraint is a chance to lose one.
  insert into public.audit_findings (company_id, run_id, section_id, ordinal, kind, title, word, basis)
    values (co, run, sec, 3, 'finding', 'probe: on file', 'on_file', 'read'),
           (co, run, sec, 4, 'finding', 'probe: stale', 'stale', 'read'),
           (co, run, sec, 5, 'finding', 'probe: nothing on file', 'nothing_on_file', 'read'),
           (co, run, sec, 6, 'finding', 'probe: no document', 'not_a_document_question', 'read');

  delete from public.audit_runs where id = run;
  raise notice 'MIGRATION 094: five words in, a sixth refused, and a suggestion still cannot be one of them.';
end $$;

-- The definition, read back out of the catalog rather than trusted from above.
do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint
   where conrelid = 'public.audit_findings'::regclass and conname = 'audit_findings_word_check';
  if def is null then
    raise exception 'MIGRATION 094 FAILED: audit_findings_word_check is gone.';
  end if;
  if def not like '%on_file_gaps%' then
    raise exception 'MIGRATION 094 FAILED: the constraint does not name on_file_gaps: %', def;
  end if;
  raise notice 'MIGRATION 094: audit_findings_word_check is now %', def;
end $$;

commit;
