-- 042 — TWO DIFFERENT NUMBERS WERE LIVING UNDER ONE WORD.
--
-- `document_scans.searches` has never held the number of searches. `lib/documentScan.ts` wrote
-- `answer.sources.length`, and `reassemble()` in `lib/ai.ts` builds that list by deduplicating
-- the CITATIONS on the answer by URL — so the column held "how many distinct sources the answer
-- cited", which is a different quantity and can be zero on a call that searched, or larger than
-- the number of searches when one search is cited several times.
--
-- It was caught on 25 September by the two numbers disagreeing in the same second: the runner
-- printed "0 searches" for a scan whose ledger line read `searches=2`, on a call sent with
-- `web_search.max_uses = 2`. Both were right about their own quantity and the word was wrong
-- about one of them.
--
-- This is the honesty rule in `CLAUDE.md` §6 applied to our own instrumentation rather than to
-- the product's wording: the report's quiet last line is meant to tell a person "how many
-- sources were looked up", and it has been telling them something else. A number nobody can
-- trace back to what produced it does not belong on a row (§9a).
--
-- SO: the existing column is RENAMED to what it actually holds, and a new `searches` is added
-- for the billed count that `ai_calls` already records. The rename keeps every stored value
-- attached to its true meaning — dropping and recreating would have silently rebased every
-- historical row onto a quantity it never measured.
--
-- The new column is NULL for every existing row, deliberately. The billed count was not
-- captured at the time and there is no honest way to derive it now: the `ai_calls` row is
-- linked, but a scan saved with a null `ai_call_id` (the ledger write is not awaited) has no
-- link at all. NULL says "not recorded", which is true. Zero would say "it ran none", which is
-- not.

begin;

alter table public.document_scans
  rename column searches to cited_sources;

alter table public.document_scans
  add column if not exists searches integer;

comment on column public.document_scans.cited_sources is
  'How many DISTINCT sources the answer cited, deduplicated by URL. Not the number of searches: '
  'an answer can cite one source from two searches, or search and cite nothing. Was called '
  '"searches" until migration 042.';
comment on column public.document_scans.searches is
  'How many web searches Anthropic BILLED for this scan, taken from the ai_calls row, which reads '
  'usage.server_tool_use.web_search_requests. NULL on rows written before migration 042: the '
  'number was not captured and zero would be a claim rather than an absence.';

-- ---------------------------------------------------------------------------
-- VERIFY. The rename must have moved the values, not created an empty column beside them, and
-- the new column must accept a count and stay null when nobody supplies one.
-- ---------------------------------------------------------------------------
do $$
declare
  co uuid; doc uuid; sc uuid; n integer;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'document_scans' and column_name = 'cited_sources'
  ) then
    raise exception 'MIGRATION 042 FAILED: document_scans.cited_sources does not exist after the rename.';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'document_scans'
       and column_name = 'searches' and is_nullable = 'NO'
  ) then
    raise exception 'MIGRATION 042 FAILED: the new searches column is NOT NULL; historical rows have no honest value for it.';
  end if;

  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 042: no company on this database, row probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-042-probe.pdf', 'probe/042', 'application/pdf', 1, 'upload', 'uploaded')
    returning id into doc;

  -- a scan that names neither count: cited_sources takes its default, searches stays unrecorded
  insert into public.document_scans (document_id, company_id, kind, status)
    values (doc, co, 'program', 'gaps_found') returning id into sc;
  select searches into n from public.document_scans where id = sc;
  if n is not null then
    raise exception 'MIGRATION 042 FAILED: searches defaulted to % instead of staying NULL.', n;
  end if;

  -- and the two are independently settable, which is the whole point of there being two
  update public.document_scans set cited_sources = 5, searches = 2 where id = sc;
  select searches into n from public.document_scans where id = sc;
  if n <> 2 then
    raise exception 'MIGRATION 042 FAILED: searches did not store the billed count.';
  end if;
  if (select cited_sources from public.document_scans where id = sc) <> 5 then
    raise exception 'MIGRATION 042 FAILED: cited_sources did not store its own count.';
  end if;

  delete from public.documents where id = doc;   -- cascades to the scan
  raise notice 'MIGRATION 042: cited_sources carries the old values, searches is a separate nullable count.';
end $$;

commit;
