-- =================================================================================================
-- 085 — ONE READ OF THE WEBSITE, STORED AS A PROPOSAL.
-- =================================================================================================
--
-- WHY.
--
-- `docs/ACCOUNT-PLAN.md` decision 9: *"The website is the first door for information. One read. It
-- proposes; the person confirms; nothing is written on the model's word alone."* Step 12 made
-- signup store the website without reading it. This is where it is read, and the whole of this
-- migration is the place the ANSWER goes while it waits to be confirmed.
--
-- Two things, and a self-test that tries to break both:
--
--   1. `website_reads` — one row per read: what we fetched, what the model proposed, and whether
--      it worked. Written only by the service role; readable by the people of that company and
--      nobody else.
--   2. `ai_calls_task_check` widened with `website`, so the ledger can say what that spend was
--      for. The same drop-and-recreate 050, 064, 066 and 073 each did, with every prior value
--      restated.
--
-- *** WHY NOT A COLUMN ON `companies`, WHICH WOULD HAVE BEEN SIMPLER. ***
--
-- Two routes do `select('*')` on that table — `app/api/account/route.ts:51`, which runs on every
-- My Account load, and `app/api/account/export/route.ts:52`, which builds the customer's
-- "download my data" file. A jsonb column there would ship our reading of a stranger's website to
-- the browser on every page load and into the export, and the only thing keeping the OLD
-- `scan_result` out of the model's view is that `lib/companyContext.ts:243` happens to name its
-- columns. That is a protection by habit, and this release is not going to add a second one.
--
-- A separate table also carries what a column cannot: the CLAIM. The row is inserted as `reading`
-- before any fetch happens, so a second press finds it and does nothing, and the walk's first
-- screen can never arrive and find nothing at all (`lib/topicClaim.ts`'s pattern, `CLAUDE.md`
-- §3.11).
--
-- *** WHAT THIS MIGRATION DELIBERATELY DOES NOT DO. ***
--
--   · **No unique index on `company_id`** (the owner, at the step 13 stop). "Read once" is what
--     the ROUTE enforces — a POST while a row is `reading` or `ready` does nothing — and an index
--     would foreclose the re-read a customer will eventually want: two of the seven sites measured
--     at the stop failed for reasons that are temporary (a bot challenge, a slow day), and a
--     person who fixes their website must not be told "we already tried". **A "read it again"
--     button is owed and is not built.** `GET` returns the newest row, so a second row would
--     simply win.
--   · **It does not stamp `accepted_at`.** That column is filled by step 14's confirmation route,
--     running as the service role (the owner's answer at the stop), which is also why
--     `authenticated` gets no UPDATE here. The walk's "Yes, that's us" writes the confirmed facts
--     through the routes that already own them — `/api/company-information` and `/api/sites` —
--     and this column records only that it happened.
--   · **It writes no `companies` column and no `entities` row.** Nothing is written on the model's
--     word; that is the whole decision, and a migration that gave this table a trigger onto
--     `companies` would quietly undo it.
--   · **It does not touch `companies.scan_result`**, the old scanner's column, nor
--     `app/api/scan-website/route.ts`. They are read by `lib/companyContext.ts:265` and
--     `prompts/checklist.ts:328` for companies that signed up before step 12 and are written by
--     nothing. Removing them is its own step with its own reading.
-- =================================================================================================


-- =================================================================================================
-- 1. THE TABLE.
--
-- `status` is the only thing the walk polls, and the three values are the only three states there
-- are: we are reading, there is a proposal, or it did not work and `reason` says why in a word the
-- product can turn into a sentence. There is no `succeeded` boolean anywhere near it, because a
-- read that finished with nothing to propose is `ready` with an empty proposal, and that is a
-- different thing from a read that failed.
--
-- `raw_text` holds the model's own answer. `CLAUDE.md` §5 asks for exactly this on a parse failure
-- — "fold in the first 3000 characters of the raw model response so a bad extraction is
-- diagnosable from the database days later" — and the bad extraction we would otherwise be
-- guessing at is the one that produced `bad_shape`.
-- =================================================================================================

create table if not exists public.website_reads (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  -- The host as it was actually read, so the failure sentence can name it: "We couldn't read
  -- ‹host›". It is `companies.website_url` at the moment of the read and not a live reference to
  -- it, because that column can change afterwards and this row is a record of what happened.
  host         text not null,
  status       text not null default 'reading'
                 check (status in ('reading', 'ready', 'failed')),
  -- Filled only when `status = 'failed'`. One of the reasons `lib/websiteFetch.ts` can return,
  -- plus the two the model path can add. Checked here so a typo in a route cannot invent a state
  -- the page has no sentence for.
  reason       text check (reason in (
                 'blocked_host', 'unreachable', 'not_found', 'nothing_readable', 'too_slow',
                 'bad_shape', 'model_refused')),
  pages        jsonb,
  proposal     jsonb,
  raw_text     text,
  model        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  accepted_at  timestamptz,
  constraint website_reads_failed_has_a_reason
    check ((status = 'failed') = (reason is not null))
);

comment on table public.website_reads is
  'One read of a company''s own website: the pages fetched, what the model proposed from them, and '
  'whether it worked. A PROPOSAL and never a fact — nothing here is written to companies or '
  'entities until a person presses "Yes, that''s us" in the walk, and then it goes through the '
  'routes that own those tables. Written by the service role only. ACCOUNT-PLAN decision 9, My '
  'Account step 13.';

comment on column public.website_reads.status is
  'reading | ready | failed. The row is inserted as `reading` BEFORE any fetch, so it is also the '
  'claim: a second POST finds it and does nothing, and the walk can never find nothing at all.';

comment on column public.website_reads.pages is
  'The URLs actually fetched, in order, with their sizes. The evidence behind the card: a person '
  'who disagrees with the proposal can be shown what it was read from.';

comment on column public.website_reads.proposal is
  'The VALIDATED proposal — `prompts/website-read.ts` `parseProposal`, which refuses anything not '
  'in shape rather than repairing it, and drops a NAICS code that is not in `lib/naicsTitles.ts`.';

comment on column public.website_reads.raw_text is
  'What the model actually said. Kept for the case the parse refused (`reason = bad_shape`), which '
  'is undiagnosable days later without it — CLAUDE.md §5.';

comment on column public.website_reads.accepted_at is
  'When the person pressed "Yes, that''s us". Stamped by step 14''s confirmation route as the '
  'service role; `authenticated` holds no UPDATE on this table at all.';

create index if not exists idx_website_reads_company on public.website_reads (company_id, started_at desc);

comment on index public.idx_website_reads_company is
  'The one query the product makes: the NEWEST read for this company. Company-leading, as every '
  'index in this schema is (CLAUDE.md §3.7).';

alter table public.website_reads enable row level security;

-- REVOKE THEN GRANT, BOTH ROLES. Since migration 068 `postgres`'s default privileges on public
-- grant `anon` and `authenticated` nothing, but `supabase_admin`'s still grant both everything for
-- objects IT creates, `postgres` cannot change those, and a redundant REVOKE costs nothing (§3.6).
-- §3 below reads all eight rights back for both roles rather than trusting these lines.
revoke all on table public.website_reads from anon;
revoke all on table public.website_reads from authenticated;

-- SELECT and nothing else. A person reads the proposal made for their own company; they never
-- write this table, because every write here is OUR record of what WE did.
grant select on table public.website_reads to authenticated;

drop policy if exists website_reads_select on public.website_reads;
create policy website_reads_select on public.website_reads
  for select to authenticated
  using (public.website_reads.company_id = public.auth_company_id());

-- No INSERT, UPDATE or DELETE policy, and no grant for any of the three. Deliberate, and §3 proves
-- all three absent rather than describing them as absent.


-- =================================================================================================
-- 2. THE LEDGER LEARNS THE WORD.
--
-- `ai_calls_task_check` — 16 values, plus `website`. Owned by 040, then 050, then 064, then 066,
-- then 073; owned by this file now. Every prior value restated, read from the catalog on staging
-- rather than from the prior migration file. `lib/costLedger.ts` `LEDGER_TASKS` must match, and
-- `tests/unit/costLedger.test.ts` asserts that it does.
--
-- Without this, the website read logs as `other` and `npm run cost` cannot say what the money was
-- spent on — which is the whole argument of `DECISIONS.md` §128 J.
-- =================================================================================================

alter table public.ai_calls drop constraint if exists ai_calls_task_check;
alter table public.ai_calls add constraint ai_calls_task_check check (task in (
  'research', 'checklist', 'substeps', 'convert', 'summarise',
  'gate', 'critique', 'audit', 'document_review', 'document_scan', 'document_draft', 'howto',
  'other', 'hr', 'hr_check',
  'calendar',
  'website'
));


-- =================================================================================================
-- 3. THE SELF-TEST — 24 CHECKS.
--
-- It proves the rights by READING them (a grant list says what was added, not what a role holds),
-- it proves the two absences by first proving the probe can see a presence (§9a), and it proves the
-- cascade by deleting a company and looking for the row. Every failure raises, which rolls the
-- whole migration back.
-- =================================================================================================

do $$
declare
  n         bigint;
  ok        text;
  co        uuid;
  read_id   uuid;
  pol       text;
begin
  -- ---- 1. THE TABLE EXISTS, WITH RLS ON. ----
  if to_regclass('public.website_reads') is null then
    raise exception 'MIGRATION 085 FAILED: website_reads does not exist.';
  end if;
  if not (select c.relrowsecurity from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
           where ns.nspname = 'public' and c.relname = 'website_reads') then
    raise exception 'MIGRATION 085 FAILED: RLS is not enabled on website_reads, so the policy below decides nothing.';
  end if;

  -- ---- 2. ONE POLICY, FOR SELECT, SCOPED THROUGH auth_company_id(). ----
  select count(*) into n from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relname = 'website_reads';
  if n <> 1 then
    raise exception 'MIGRATION 085 FAILED: website_reads has % policies, expected exactly 1 (select).', n;
  end if;
  select pg_get_expr(p.polqual, p.polrelid) into pol
    from pg_policy p join pg_class c on c.oid = p.polrelid
   where c.relname = 'website_reads' and p.polname = 'website_reads_select';
  if pol is null then
    raise exception 'MIGRATION 085 FAILED: website_reads_select has no USING clause.';
  end if;
  if pol not like '%auth_company_id%' then
    raise exception 'MIGRATION 085 FAILED: website_reads_select does not scope through auth_company_id(): %', pol;
  end if;

  -- ---- 3. A PERSON MAY READ, AND READ IS ALL. ----
  if not has_table_privilege('authenticated', 'public.website_reads', 'SELECT') then
    raise exception 'MIGRATION 085 FAILED: a person cannot read website_reads, so the walk has nothing to show.';
  end if;
  foreach ok in array array['INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.website_reads', ok) then
      raise exception 'MIGRATION 085 FAILED: a person holds % on website_reads.', ok;
    end if;
  end loop;
  -- …and not on any single COLUMN either. `has_table_privilege` answers FALSE for a right held on
  -- columns rather than on the table (CLAUDE.md §3.6), which is exactly how a column grant hides —
  -- 082's own `grant update (cancelled_at)` is invisible to the loop above.
  --
  -- *** INSERT AND UPDATE, AND NOT DELETE, BECAUSE POSTGRES REFUSES THE QUESTION. *** The first
  -- version of this block asked `has_any_column_privilege(..., 'DELETE')` and the migration was
  -- refused outright: `ERROR: unrecognized privilege type: "DELETE" (SQLSTATE 22023)`. There is no
  -- such thing as a column-level DELETE — the column privileges are SELECT, INSERT, UPDATE and
  -- REFERENCES — so the table check above is already the whole of that question. Nothing was
  -- applied, which is what a verify block is for.
  foreach ok in array array['INSERT', 'UPDATE'] loop
    if has_any_column_privilege('authenticated', 'public.website_reads', ok) then
      raise exception 'MIGRATION 085 FAILED: a person holds % on some COLUMN of website_reads.', ok;
    end if;
  end loop;
  -- SELECT is granted on the table, so the column form must agree. The presence that proves the
  -- two absences above are being read rather than erroring quietly.
  if not has_any_column_privilege('authenticated', 'public.website_reads', 'SELECT') then
    raise exception 'MIGRATION 085 FAILED: the column-privilege probe cannot see the SELECT a person does hold, so its answers above mean nothing.';
  end if;

  -- ---- 4. anon HOLDS NOTHING, ALL EIGHT RIGHTS. ----
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('anon', 'public.website_reads', ok) then
      raise exception 'MIGRATION 085 FAILED: anon holds % on website_reads.', ok;
    end if;
  end loop;

  -- ---- 5. AND service_role HOLDS WHAT THE ROUTE NEEDS. ----
  -- The presence that makes checks 3 and 4 mean something: a database where nobody could do
  -- anything would pass them both.
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not has_table_privilege('service_role', 'public.website_reads', ok) then
      raise exception 'MIGRATION 085 FAILED: service_role cannot % website_reads, so the read cannot be recorded.', ok;
    end if;
  end loop;

  -- ---- 6. THE LEDGER ACCEPTS `website`… ----
  insert into public.ai_calls (company_id, task, model, input_tokens, output_tokens)
       values (null, 'website', '085 probe model', 1, 1);
  select count(*) into n from public.ai_calls where model = '085 probe model' and task = 'website';
  if n <> 1 then
    raise exception 'MIGRATION 085 FAILED: ai_calls did not accept task = website.';
  end if;

  -- ---- 7. …AND STILL REFUSES A WORD NOBODY DEFINED. ----
  -- The presence above is what makes this absence a test of the CONSTRAINT rather than of the
  -- insert (§9a).
  begin
    insert into public.ai_calls (company_id, task, model, input_tokens, output_tokens)
         values (null, 'not_a_real_task', '085 probe model', 1, 1);
    raise exception 'MIGRATION 085 FAILED: ai_calls accepted a task nobody defined, so the check constrains nothing.';
  exception when check_violation then null;
  end;
  delete from public.ai_calls where model = '085 probe model';

  -- ---- 8. A THROWAWAY COMPANY, A READ, AND THE CASCADE. ----
  insert into public.companies (name) values ('085 probe company') returning id into co;

  insert into public.website_reads (company_id, host, status)
       values (co, 'probe.example', 'reading') returning id into read_id;
  if (select status from public.website_reads where id = read_id) <> 'reading' then
    raise exception 'MIGRATION 085 FAILED: a new read did not start as `reading`.';
  end if;
  if (select started_at from public.website_reads where id = read_id) is null then
    raise exception 'MIGRATION 085 FAILED: started_at was not stamped by the default.';
  end if;

  -- A failed read must name a reason, and a reason must not sit on a read that did not fail.
  begin
    update public.website_reads set status = 'failed' where id = read_id;
    raise exception 'MIGRATION 085 FAILED: a read could be marked failed with no reason, so the page has nothing to say.';
  exception when check_violation then null;
  end;
  begin
    update public.website_reads set reason = 'unreachable' where id = read_id;
    raise exception 'MIGRATION 085 FAILED: a reason could be set on a read that has not failed.';
  exception when check_violation then null;
  end;
  update public.website_reads set status = 'failed', reason = 'unreachable', finished_at = now()
   where id = read_id;
  if (select reason from public.website_reads where id = read_id) <> 'unreachable' then
    raise exception 'MIGRATION 085 FAILED: a failed read could not record its reason.';
  end if;

  -- An invented reason is refused, for the same cause as the ledger's: a page has no sentence for it.
  begin
    update public.website_reads set reason = 'the dog ate it' where id = read_id;
    raise exception 'MIGRATION 085 FAILED: website_reads accepted a reason nobody defined.';
  exception when check_violation then null;
  end;

  -- The product's own query — the NEWEST read for a company — finds it.
  select count(*) into n from (
    select id from public.website_reads where company_id = co order by started_at desc limit 1
  ) q;
  if n <> 1 then
    raise exception 'MIGRATION 085 FAILED: the newest-read query returned % rows.', n;
  end if;

  -- ---- 9. AND IT GOES WITH THE COMPANY. ----
  -- `/api/account` DELETE names this table in DELETED_BY_CASCADE_OR_PARENT rather than in its
  -- delete loop, which is only honest if the cascade is real. This is the check that says it is.
  delete from public.companies where id = co;
  select count(*) into n from public.website_reads where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 085 FAILED: % read(s) outlived the company, so a deletion leaves our reading of their website behind.', n;
  end if;

  raise notice 'MIGRATION 085 OK: website_reads exists with RLS and one SELECT policy through '
    'auth_company_id(); a person may read it and holds no INSERT, UPDATE or DELETE on the table '
    'or on any column of it; anon holds none of the eight rights; service_role holds the four the '
    'route needs; the ledger accepts `website` and still refuses a word nobody defined; a read '
    'starts as `reading`, cannot be failed without a reason nor given one without failing, and '
    'goes with its company.';
end $$;
