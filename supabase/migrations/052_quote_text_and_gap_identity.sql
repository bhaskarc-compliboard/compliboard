-- 052 — THE TEXT A QUOTE IS CHECKED AGAINST, AND A GAP THAT KNOWS ITS OWN PREDECESSOR
--
-- Two things Documents Run 5 exposed, closed together because both are about a reading
-- surviving contact with the next reading.
--
-- ---------------------------------------------------------------------------
-- 1. `document_scans.extracted_text` — WHY A COLUMN AND NOT A COMPUTATION
--
-- `verifyQuote()` has run on every fact and every gap since Run 1 and its answer was null for
-- every document this product has ever read. Not false — null, "there was nothing to check
-- against". The cause is one line in `lib/documentScan.ts`: the text it compares against is
-- built from the parser's TEXT blocks, and a PDF is sent to the model whole as a document block
-- and produces none. Every golden fixture is a PDF, so the column migration 047 added has 73
-- rows in it and all 73 are null, and the drawer's "quote not found in the file" warning — the
-- one thing standing between a person and a confidently paraphrased quote — can never appear.
--
-- Run 6 extracts the text alongside sending the file, so the verdict becomes real. It is STORED
-- rather than recomputed because a quote that was verified against a file the customer has since
-- replaced must still be explainable: the check is evidence, and evidence you cannot re-read is
-- an assertion. Nullable, and null is the honest answer for a scanned page — a photograph of a
-- log yields no text and its quotes stay unverifiable, which is not the same as wrong.
--
-- ---------------------------------------------------------------------------
-- 2. `document_gaps.status = 'superseded'` and `superseded_by`
--
-- A re-scan writes new gap rows. Run 5 carried a checklist across by matching titles, and Run 5
-- also measured that this model renames every gap between readings, so the matcher found nothing
-- and the checklist stayed on a row the current report no longer lists. It was not lost — it was
-- shown under "From earlier readings" — but the person's work and the finding it is about had
-- come apart.
--
-- Run 6 asks the model instead: it is shown the open gaps and names the one each new gap is the
-- same finding as. When it names one, that old row is CLOSED as `superseded` and points at its
-- replacement. Two consequences worth stating:
--
--   · `document_index_v.open_gap_count` counts `status = 'open'` across ALL of a document's
--     scans, so today every re-scan inflates it — 01-eap-chemical shows six open gaps from two
--     readings of a five-gap document. Superseding is what makes that count mean something.
--   · CLOSE, NEVER DELETE (migration 040's own words). The row stays, keeps its checklist, keeps
--     its draft, and now says what replaced it.
--
-- `superseded_by` is `on delete set null`: losing the successor must not take the predecessor
-- with it.

begin;

-- ------------------------------------------------------------
-- 1. the text
-- ------------------------------------------------------------
alter table public.document_scans
  add column if not exists extracted_text text;

comment on column public.document_scans.extracted_text is
  'The text extracted from the file, used to verify quotes. Null when the format yields none — '
  'a scanned page, an image — which is why quote_verified is null there rather than false.';

-- ------------------------------------------------------------
-- 2. gap identity
-- ------------------------------------------------------------
alter table public.document_gaps
  drop constraint if exists document_gaps_status_check;
alter table public.document_gaps
  add constraint document_gaps_status_check
  check (status in ('open', 'closed', 'dismissed', 'superseded'));

alter table public.document_gaps
  add column if not exists superseded_by uuid references public.document_gaps(id) on delete set null;

create index if not exists idx_document_gaps_superseded_by
  on public.document_gaps (superseded_by) where superseded_by is not null;

comment on column public.document_gaps.superseded_by is
  'The gap on a later scan that the model said is the same finding. Set together with '
  'status = superseded. The row is never deleted: it keeps its checklist and its draft.';

-- ------------------------------------------------------------
-- GRANTS. Neither of these is a new table, so no new grant is needed — but the rule is to READ
-- what the roles hold rather than assume the parent table's grants still say what they said
-- (§3.6). Asserted below rather than restated.
-- ------------------------------------------------------------

do $$
declare
  co uuid; doc uuid; sc uuid; g1 uuid; g2 uuid; n int;
begin
  -- ==========================================================
  -- A. the new column exists and takes text and null
  -- ==========================================================
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'document_scans'
                    and column_name = 'extracted_text' and is_nullable = 'YES') then
    raise exception 'MIGRATION 052 FAILED: document_scans.extracted_text is missing or not nullable.';
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'document_gaps'
                    and column_name = 'superseded_by') then
    raise exception 'MIGRATION 052 FAILED: document_gaps.superseded_by is missing.';
  end if;

  -- ==========================================================
  -- B. THE CHECK IS TESTED BY TRYING TO BREAK IT (§3.7).
  -- ==========================================================
  insert into public.companies (name, industry, state)
       values ('Migration 052 probe', 'chemical manufacturing', 'OR') returning id into co;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'migration-052-probe.pdf', 'probe/052', 'application/pdf') returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, extracted_text)
       values (doc, co, 'program', 'gaps_found', 'the words in the file') returning id into sc;

  -- the column round-trips
  if (select extracted_text from public.document_scans where id = sc) is distinct from 'the words in the file' then
    raise exception 'MIGRATION 052 FAILED: extracted_text did not round-trip.';
  end if;
  -- ...and takes null, which is what a scanned page writes
  update public.document_scans set extracted_text = null where id = sc;
  if (select extracted_text from public.document_scans where id = sc) is not null then
    raise exception 'MIGRATION 052 FAILED: extracted_text would not go back to null.';
  end if;

  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title)
       values (sc, doc, co, 1, 'the older finding') returning id into g1;
  insert into public.document_gaps (scan_id, document_id, company_id, ordinal, title)
       values (sc, doc, co, 2, 'the same finding, read again') returning id into g2;

  -- superseded is now a value the column accepts
  update public.document_gaps set status = 'superseded', superseded_by = g2 where id = g1;
  if (select status from public.document_gaps where id = g1) <> 'superseded' then
    raise exception 'MIGRATION 052 FAILED: status would not take superseded.';
  end if;

  -- ...and a value nobody defined is still refused. A CHECK nobody has tried to break is a
  -- comment (§3.7), and widening an enum is exactly where one quietly stops refusing anything.
  begin
    update public.document_gaps set status = 'replaced' where id = g1;
    raise exception 'MIGRATION 052 FAILED: document_gaps.status accepted "replaced".';
  exception when check_violation then null; end;

  -- the old values still pass
  begin
    update public.document_gaps set status = 'dismissed' where id = g1;
    update public.document_gaps set status = 'superseded' where id = g1;
  exception when check_violation then
    raise exception 'MIGRATION 052 FAILED: the existing status values stopped being accepted.';
  end;

  -- ==========================================================
  -- C. ON DELETE SET NULL — the predecessor outlives its successor
  -- ==========================================================
  delete from public.document_gaps where id = g2;
  select count(*) into n from public.document_gaps where id = g1;
  if n <> 1 then
    raise exception 'MIGRATION 052 FAILED: deleting the successor deleted the predecessor.';
  end if;
  if (select superseded_by from public.document_gaps where id = g1) is not null then
    raise exception 'MIGRATION 052 FAILED: superseded_by was not set null when the successor went.';
  end if;

  -- ==========================================================
  -- D. PRIVILEGES READ BACK, NEVER TAKEN FROM A GRANT LIST (§3.6)
  -- ==========================================================
  if has_table_privilege('anon', 'public.document_gaps', 'SELECT')
     or has_table_privilege('anon', 'public.document_scans', 'SELECT') then
    raise exception 'MIGRATION 052 FAILED: anon can read a reading.';
  end if;
  -- authenticated reads them and writes neither: a signed-in user must not be able to author a
  -- reading. Unchanged by this migration, asserted because a widened CHECK is exactly the sort
  -- of change that gets made with a stray GRANT beside it.
  if not has_table_privilege('authenticated', 'public.document_gaps', 'SELECT') then
    raise exception 'MIGRATION 052 FAILED: authenticated lost SELECT on document_gaps.';
  end if;
  if has_table_privilege('authenticated', 'public.document_scans', 'INSERT') then
    raise exception 'MIGRATION 052 FAILED: authenticated can INSERT a scan.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 052 OK: extracted_text stores and nulls; superseded is accepted and "replaced" is not; the predecessor outlives its successor.';
end $$;

commit;
