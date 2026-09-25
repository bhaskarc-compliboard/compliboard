-- 045 — WHEN THE PERSON TELLS US THE SCAN GOT IT WRONG.
--
-- WHY. The vision's freedom is "you got that wrong, and here's why", and it is the one thing a
-- customer can say back to the model. A scan calls an Emergency Action Plan a `policy`, files a
-- forklift log under Oregon DEQ, or dates a permit from the wrong line; the person who owns the
-- document knows better, and until now there was nowhere for them to say so.
--
-- *** A CORRECTION IS A NEW ROW, NOT AN EDIT. *** `document_scans` is what the model concluded on
-- a given day from a given file, and rewriting it would destroy the evidence that it ever said
-- anything else — the same rule as `obligations` (§3.2, marked never deleted) and dismissed gaps.
-- So corrections accumulate beside the scan, the newest one per field wins, and the scan row
-- stays exactly as it was written. It also means a re-scan cannot silently undo somebody's
-- correction: the view prefers the correction over whatever the new scan says, and the next scan
-- is TOLD about it (`buildScanContext`) rather than being left to make the same mistake again.
--
-- `old_value` is kept as well as `new_value` because "they changed kind to permit" is half a
-- sentence. What it was is what makes the correction legible a month later, and it is the only
-- record of what the model said if a later scan overwrites the scan row's own value.
--
-- BOTH ARE jsonb, not text: `agencies` and `subjects` are lists, `kind` and `site` are scalars,
-- and one column that holds either is better than two that each hold half.
--
-- WHO MAY WRITE ONE. Company members read; the SERVER writes. Same reasoning as §132 and it is
-- not a formality: a correction outranks the model on this customer's screen and is fed to the
-- next scan as fact. RLS can say "your company" and cannot say "through the route that recorded
-- who did it and what it replaced", so the route holds that and the grant does not.
--
-- `documents.latest_confirmed_at` is the other half of the freshness nudge. The nudge asks "this
-- document is N years old; if a newer version exists, add it" and it needs two answers, not one:
-- "here is the newer one" is an upload, and "this IS the latest" is a fact about the document
-- that has to be recorded or the nudge asks again tomorrow and the product looks like it was not
-- listening.

begin;

create table if not exists public.document_corrections (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  -- The fields a person may correct. Deliberately NOT everything the scan produces: a gap is
  -- dismissed with a reason, a fact is accepted or rejected, and those have their own verbs.
  -- This is only "what this document IS".
  field        text not null check (field in ('kind', 'agencies', 'subjects', 'site', 'doc_date', 'title')),
  old_value    jsonb,
  new_value    jsonb,
  reason       text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_document_corrections_company_document
  on public.document_corrections (company_id, document_id, field, created_at desc);

alter table public.documents
  add column if not exists latest_confirmed_at timestamptz;

comment on table public.document_corrections is
  'One row per correction a person makes to what a document IS. Newest per field wins; the scan '
  'row is never edited, so what the model said stays readable and a re-scan cannot undo a person.';
comment on column public.documents.latest_confirmed_at is
  'When somebody answered "this is the latest" to the freshness nudge. Null means unanswered — '
  'not "no", which is why it is a timestamp rather than a boolean.';

-- ---------------------------------------------------------------------------
-- GRANTS. REVOKE first, for both roles, because default privileges on `public` hand anon and
-- authenticated full DML on any new table before a single GRANT runs (§3.6).
-- ---------------------------------------------------------------------------
revoke all on table public.document_corrections from anon;
revoke all on table public.document_corrections from authenticated;
grant select on table public.document_corrections to authenticated;   -- read only; the server writes
grant all on table public.document_corrections to service_role;

alter table public.document_corrections enable row level security;

drop policy if exists document_corrections_select on public.document_corrections;
create policy document_corrections_select on public.document_corrections
  for select to authenticated
  using (company_id = public.auth_company_id());

-- ---------------------------------------------------------------------------
-- THE VIEW, PREFERRING A CORRECTION OVER THE SCAN, FIELD BY FIELD.
--
-- One lateral per corrected field, each taking the newest row for that field. A field nobody has
-- corrected falls through to the scan exactly as before, so an uncorrected document is
-- byte-identical to what 044 produced.
-- ---------------------------------------------------------------------------
-- DROPPED AND RECREATED, not `create or replace`. Replace can only APPEND columns; this adds
-- latest_confirmed_at and version_confirmed in the middle, and Postgres refuses with
-- "cannot change name of view column". A view holds no data, so dropping it costs nothing —
-- but the grants go with it, which is why they are restated below rather than assumed.
drop view if exists public.document_index_v;
create view public.document_index_v
with (security_invoker = true) as
with newest as (
  -- `id desc` is a TIE-BREAK, not decoration. `created_at` defaults to now(), which is
  -- TRANSACTION time — two corrections written in one transaction carry the identical timestamp
  -- and `distinct on` then picks whichever row it happens to reach first. Found by this
  -- migration's own probe, which corrected `kind` twice and got the first answer back. In
  -- production the two would be separate requests, so this only bites where it was found; a
  -- non-deterministic view is still a view nobody can reason about.
  select distinct on (document_id, field)
         document_id, field, new_value
    from public.document_corrections
   order by document_id, field, created_at desc, id desc
)
select
  d.id                              as document_id,
  d.company_id,
  coalesce(
    nullif(c_title.new_value #>> '{}', ''),
    nullif(s.title, ''),
    d.name)                         as title,
  d.name                            as file_name,
  coalesce(c_kind.new_value #>> '{}', s.kind)          as kind,
  coalesce(c_ag.new_value, s.agencies, '[]'::jsonb)    as agencies,
  coalesce(c_sub.new_value, s.subjects, '[]'::jsonb)   as subjects,
  s.issuer,
  coalesce(c_site_e.name, e.name)   as site_name,
  coalesce((c_site.new_value #>> '{}')::uuid, d.entity_id) as entity_id,
  f.name                            as folder_name,
  d.folder_id,
  coalesce((c_date.new_value #>> '{}')::date, s.doc_date) as doc_date,
  s.doc_date_kind,
  s.significant_date,
  s.significant_date_kind,
  s.scanned_at,
  d.uploaded_at,
  d.latest_confirmed_at,
  s.status                          as scan_status,
  d.status                          as document_status,
  s.could_not_read_reason,
  s.summary,
  d.version_of,
  d.version_confirmed,
  s.id                              as scan_id,
  coalesce(g.open_gaps, 0)          as open_gap_count,
  (select count(*) from newest n where n.document_id = d.id)::int as correction_count,

  case
    -- A conclusion beats an absence (044).
    when d.status = 'could_not_read' or s.status = 'could_not_read' then 'could_not_read'
    when d.status in ('uploaded', 'reading') or s.id is null then 'not_yet_read'
    when s.status = 'gaps_found' then 'needs_work'
    -- *** THE CORRECTED KIND, NOT THE SCANNED ONE. *** If a person says this is a permit, the
    -- expiry arithmetic has to follow them, or the correction changes the label and not the
    -- meaning — which is worse than not offering it.
    when coalesce(c_kind.new_value #>> '{}', s.kind) in ('permit', 'certificate')
         and s.significant_date is not null and s.significant_date < current_date then 'expired'
    when coalesce(c_kind.new_value #>> '{}', s.kind) in ('permit', 'certificate')
         and s.significant_date is not null and s.significant_date <= current_date + 90 then 'expiring'
    when coalesce(c_kind.new_value #>> '{}', s.kind) in ('permit', 'certificate') then 'current'
    when s.status = 'no_gaps_found' then 'current'
    when coalesce(c_kind.new_value #>> '{}', s.kind) = 'record' then 'recorded'
    else 'on_file'
  end                               as display_status

from public.documents d
left join public.document_scans s on s.document_id = d.id and s.is_current
left join public.company_folders f on f.id = d.folder_id
left join public.entities e        on e.id = d.entity_id
left join newest c_kind  on c_kind.document_id  = d.id and c_kind.field  = 'kind'
left join newest c_ag    on c_ag.document_id    = d.id and c_ag.field    = 'agencies'
left join newest c_sub   on c_sub.document_id   = d.id and c_sub.field   = 'subjects'
left join newest c_site  on c_site.document_id  = d.id and c_site.field  = 'site'
left join newest c_date  on c_date.document_id  = d.id and c_date.field  = 'doc_date'
left join newest c_title on c_title.document_id = d.id and c_title.field = 'title'
left join public.entities c_site_e on c_site_e.id = (c_site.new_value #>> '{}')::uuid
left join lateral (
  select count(*)::int as open_gaps
    from public.document_gaps dg
   where dg.document_id = d.id and dg.status = 'open'
) g on true;

comment on view public.document_index_v is
  'One row per document with the columns the Documents page groups and sorts by. A correction '
  'the person made outranks the scan, field by field, newest first. display_status is computed '
  'in SQL and follows the corrected kind. security_invoker: only rows the caller could select.';

revoke all on public.document_index_v from anon;
revoke all on public.document_index_v from authenticated;
grant select on public.document_index_v to authenticated;

-- ---------------------------------------------------------------------------
-- VERIFY. Both probes the brief asks for: the correction wins, and the write is refused.
-- ---------------------------------------------------------------------------
do $$
declare
  co uuid; doc uuid; sc uuid; got text; n int;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 045: no company on this database, probes skipped.';
    return;
  end if;

  insert into public.documents (company_id, name, file_url, file_type, file_size, source, status)
    values (co, 'migration-045-probe.pdf', 'probe/045', 'application/pdf', 1, 'upload', 'read')
    returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, title, agencies, is_current)
    values (doc, co, 'policy', 'no_gaps_found', 'What the model called it', '["OSHA"]'::jsonb, true)
    returning id into sc;

  -- Before: the scan's own values.
  select kind into got from public.document_index_v where document_id = doc;
  if got <> 'policy' then raise exception 'MIGRATION 045 FAILED: expected the scan kind, got %.', got; end if;

  -- A person corrects the kind. The view must follow, AND so must display_status.
  insert into public.document_corrections (document_id, company_id, field, old_value, new_value, reason)
    values (doc, co, 'kind', '"policy"'::jsonb, '"permit"'::jsonb, 'It is our air permit.');
  select kind into got from public.document_index_v where document_id = doc;
  if got <> 'permit' then raise exception 'MIGRATION 045 FAILED: the correction did not win, got %.', got; end if;
  select display_status into got from public.document_index_v where document_id = doc;
  if got <> 'current' then
    raise exception 'MIGRATION 045 FAILED: display_status ignored the corrected kind, got %.', got;
  end if;

  -- The NEWEST correction wins, not the first. `created_at` is stated rather than defaulted:
  -- the default is transaction time, so two rows written here would be simultaneous and the
  -- probe would be testing the tie-break instead of the ordering it means to test.
  insert into public.document_corrections (document_id, company_id, field, old_value, new_value, reason, created_at)
    values (doc, co, 'kind', '"permit"'::jsonb, '"certificate"'::jsonb, 'Actually a certificate.', now() + interval '1 second');
  select kind into got from public.document_index_v where document_id = doc;
  if got <> 'certificate' then
    raise exception 'MIGRATION 045 FAILED: the older correction won, got %.', got;
  end if;

  -- A list field, and the title.
  insert into public.document_corrections (document_id, company_id, field, old_value, new_value)
    values (doc, co, 'agencies', '["OSHA"]'::jsonb, '["Oregon DEQ","OSHA"]'::jsonb);
  select jsonb_array_length(agencies) into n from public.document_index_v where document_id = doc;
  if n <> 2 then raise exception 'MIGRATION 045 FAILED: corrected agencies did not win, length %.', n; end if;
  insert into public.document_corrections (document_id, company_id, field, old_value, new_value)
    values (doc, co, 'title', '"What the model called it"'::jsonb, '"What we call it"'::jsonb);
  select title into got from public.document_index_v where document_id = doc;
  if got <> 'What we call it' then raise exception 'MIGRATION 045 FAILED: corrected title did not win, got %.', got; end if;

  -- An UNCORRECTED field still falls through to the scan.
  select issuer into got from public.document_index_v where document_id = doc;
  if got is distinct from null then raise exception 'MIGRATION 045 FAILED: issuer should still be the scan''s null.'; end if;

  -- latest_confirmed_at starts null — unanswered, not "no".
  if (select latest_confirmed_at from public.documents where id = doc) is not null then
    raise exception 'MIGRATION 045 FAILED: latest_confirmed_at did not start null.';
  end if;

  -- field refuses a plausible wrong value
  begin
    insert into public.document_corrections (document_id, company_id, field, new_value)
      values (doc, co, 'status', '"current"'::jsonb);
    raise exception 'MIGRATION 045 FAILED: field accepted "status".';
  exception when check_violation then null; end;

  delete from public.documents where id = doc;
  raise notice 'MIGRATION 045: a correction outranks the scan, the newest wins, and display_status follows it.';
end $$;

-- *** AND THE WRITE IS REFUSED TO EVERYONE BUT THE SERVER. ***
-- Read the privileges back rather than trusting the grant list (§3.6).
do $$
declare
  n int;
begin
  if has_table_privilege('authenticated', 'public.document_corrections', 'INSERT') then
    raise exception 'MIGRATION 045 FAILED: authenticated can INSERT a correction — a correction outranks the model and is fed to the next scan.';
  end if;
  if has_table_privilege('authenticated', 'public.document_corrections', 'UPDATE')
     or has_table_privilege('authenticated', 'public.document_corrections', 'DELETE') then
    raise exception 'MIGRATION 045 FAILED: authenticated can rewrite or remove a correction.';
  end if;
  if not has_table_privilege('authenticated', 'public.document_corrections', 'SELECT') then
    raise exception 'MIGRATION 045 FAILED: company members cannot read their own corrections.';
  end if;
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'document_corrections' and grantee = 'anon';
  if n > 0 then
    raise exception 'MIGRATION 045 FAILED: anon holds % grant(s) on document_corrections.', n;
  end if;
  raise notice 'MIGRATION 045: members read, nobody but the server writes, anon holds nothing.';
end $$;

commit;
