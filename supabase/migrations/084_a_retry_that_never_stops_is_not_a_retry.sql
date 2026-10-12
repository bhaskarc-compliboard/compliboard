-- ===========================================================================
-- 084 — A RETRY THAT NEVER STOPS IS NOT A RETRY
--
-- **R7** (`CLAUDE.md` §3.12, added 12 October 2026), item **S1** of the
-- independent read of Job E (`docs/reports/jobE-independent-review.md` §2).
--
-- **WHY: one unreachable file starves every company's documents, for ever.**
--
-- `app/api/jobs/scan-documents/route.ts` tells a storage error that is NOT a
-- 404 apart from a file that is genuinely gone, and that distinction is right
-- (`lib/storageMiss.ts`): a 404 means the file is not where its row says it is,
-- which is a product failure said out loud on the row; anything else means we
-- could not reach storage just now, and writing a reading on that would tell a
-- customer to upload a second copy of a file that is still there.
--
-- So the row goes back to `uploaded` and the sweep moves on. And then:
--
--   · RULE 1 picks the globally OLDEST queued document to decide which company
--     is next — which is this one, immediately;
--   · it fails the same way, goes back to `uploaded`, and is picked again;
--   · the run spins on it until the 510-second budget ends, every five minutes,
--     and **no other company's documents are read while it lasts**.
--
-- E9 reported this as "costs nothing but is permanent and silent" and the
-- independent read corrected it: it is not one stuck document, it is the whole
-- sweep. Nothing recovers, because nothing is broken — every part is doing
-- exactly what it was told.
--
-- **WHAT THIS COLUMN IS.** How many times the sweep has started reading this
-- document and not finished. The claim increments it; a reading that lands —
-- read or could-not-read — is the end of the story and does not clear it,
-- because the number is about attempts and not about the current state. A
-- person pressing "Read it again" clears it, because that is a new story and
-- they are entitled to the same number of tries as anybody.
--
-- At the limit the document stops being retried and says so, in the owner's
-- words, and its batch finishes so the email goes — which is the half of S1
-- that matters most: a batch that never finishes is a person waiting for an
-- email that will never arrive.
--
-- **WHY NOT A TIMESTAMP INSTEAD.** A backoff on `reading_since` would make the
-- sweep try less often; it would not make it stop, and "less often, for ever"
-- is still for ever. The question the sweep has to be able to answer is "have
-- we tried this enough", and that is a count.
--
-- NOT NULL DEFAULT 0, so every existing row starts with a clean slate: no
-- document is retired by this migration, which is the direction that cannot
-- lose anything.
--
-- No grant is needed: a new column carries the table's own grants, and
-- `documents` was granted in migrations 003–010 and re-read in 066–068.
-- ===========================================================================

begin;

alter table public.documents
  add column if not exists read_attempts integer not null default 0;

comment on column public.documents.read_attempts is
  'How many times the sweep has started reading this document and not finished (R7, item S1, '
  'migration 084). The claim increments it; a landed reading leaves it alone; a person pressing '
  '"Read it again" clears it. At READ_ATTEMPT_LIMIT the sweep stops retrying, says so on the row, '
  'and lets the batch finish so the email goes. 0 for every row that existed before 12 October '
  '2026 — this migration retires nothing.';

-- No index: it is read from rows the queue query has already narrowed by company and status.

-- ===========================================================================
-- VERIFY — §3.7: the column, its default and NOT NULL, that it counts, and
-- that it can be cleared.
-- ===========================================================================
do $$
declare co uuid; d uuid; n int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'documents'
       and column_name = 'read_attempts' and data_type = 'integer'
       and is_nullable = 'NO' and column_default = '0'
  ) then
    raise exception 'MIGRATION 084 FAILED: documents.read_attempts is not an integer NOT NULL DEFAULT 0.';
  end if;

  -- Nothing that already exists is retired by this.
  select count(*) into n from public.documents where read_attempts <> 0;
  if n <> 0 then
    raise exception 'MIGRATION 084 FAILED: % existing document(s) came out with attempts against them.', n;
  end if;

  insert into public.companies (name) values ('084 probe') returning id into co;
  insert into public.documents (company_id, name, file_url, file_type, status)
       values (co, '084 probe.pdf', co || '/084.pdf', 'application/pdf', 'uploaded')
    returning id into d;

  select read_attempts into n from public.documents where id = d;
  if n <> 0 then
    raise exception 'MIGRATION 084 FAILED: a new document did not start at 0 (got %).', n;
  end if;

  -- It counts, the way the claim counts it.
  update public.documents set read_attempts = read_attempts + 1 where id = d;
  update public.documents set read_attempts = read_attempts + 1 where id = d;
  select read_attempts into n from public.documents where id = d;
  if n <> 2 then
    raise exception 'MIGRATION 084 FAILED: the column did not count (got %).', n;
  end if;

  -- And a person pressing "Read it again" clears it.
  update public.documents set read_attempts = 0 where id = d;
  select read_attempts into n from public.documents where id = d;
  if n <> 0 then
    raise exception 'MIGRATION 084 FAILED: the count could not be cleared.';
  end if;

  delete from public.documents where id = d;
  delete from public.companies where id = co;
  raise notice 'MIGRATION 084 VERIFIED: documents.read_attempts is an integer NOT NULL DEFAULT 0; no existing row carries an attempt; it counts and it clears.';
end $$;

commit;
