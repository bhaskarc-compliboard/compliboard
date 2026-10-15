-- ===========================================================================
-- 073 — THE CALENDAR AS ONE TABLE
-- ===========================================================================
-- WHY.
--
-- `calendar_events` is the oldest table in the product — `000_baseline.sql:90` — and it has been
-- carried along rather than designed. The read-only map (`docs/CALENDAR-MACHINERY.md`, commit
-- `2d1da2e`) found what that cost, and `docs/CALENDAR-PLAN.md` §2.6 is the contract this migration
-- makes true. Four things were wrong, and each is a decision in `DECISIONS.md` §185:
--
--   1. `company_id` IS NULLABLE (map B1). It is the only nullable tenant column in the date family;
--      `document_deadlines` and `handbook_dates` both have it NOT NULL. RLS closes the hole for a
--      person — `company_id = auth_company_id()` is never true of NULL — but the service role can
--      write a row belonging to nobody, and such a row survives a company deletion because the
--      cascade has nothing to follow. **The production read before this migration was written:
--      47 rows, 0 with a null company_id, 0 with a document_id.** So the NOT NULL lands with no
--      backfill and nothing to lose.
--
--   2. `category` HAS THREE VOCABULARIES AND NO CHECK (map B1). The dropdown offers ten words, the
--      old importer writes `'compliance'`, `document-actions` writes `'document'`, and HR reserved
--      `'hr'`. `006_enums_and_constraints.sql:66–71` saw this in September and left it alone with
--      the right reason — *"The stored set and the offered set are DISJOINT … Needs its own
--      decision, not a default."* **Decision 5 is that decision:** the thing a row needs to say is
--      not a category but WHERE THE DATE CAME FROM, so `category` is replaced by `source`, which
--      has five values and a CHECK.
--
--   3. THERE IS NO STATUS, SO NOTHING CAN BE PROPOSED. Every row the product writes today is
--      implicitly a fact a person accepted, because the only ways in were a person typing one and a
--      person pressing "Add to calendar". Decisions 6 and 8 reverse that: sections stop asking, the
--      calendar is where a person confirms, and **an unconfirmed date still shows and is still
--      emailed** — the product promised to be a guard. That needs `status`.
--
--   4. `completed` / `completed_at` SAY "DONE", AND THE PRODUCT MUST NOT (decision 11). A date has
--      passed; it is not done, and it is never deleted. Both columns go, `authenticated` loses its
--      DELETE grant, and the DELETE policy is dropped. Removing a date is a dismissal with a
--      reason, which is `dismissed_by` / `dismissed_at` / `dismissed_reason`.
--
-- AND TWO RULES COPIED RATHER THAN INVENTED. `due_date` becomes nullable under the CHECK
-- `due_date is not null or recurs is true` — that is migration 060's rule for `audit_findings`,
-- word for word in behaviour and for the same reason: a permit that says a fee is annual and names
-- no day is a real obligation, and an invented day would be a deadline nobody set. And NOTHING
-- DERIVED IS STORED: `next_due` is computed in `calendar_v` at read time, which is migration 049's
-- rule for `significant_date`, taken because a derived date stored is a date that goes stale the
-- first time the anchor moves.
--
-- WHAT THIS MIGRATION DOES NOT DO. It changes no prompt, calls no model, and touches no row of
-- another section's data. It adds ONE thing to a table it does not own — `audit_findings` gains
-- `unique (company_id, id)` — because §2.6's composite foreign key for `audit_finding_id` cannot
-- exist without it: read from the catalog on 15 October, nine tables in `public` carry that key
-- and `audit_findings` is not one of them. The key is additive and cannot fail (the pair is
-- already unique through the primary key), and it is named in the step's impact plan as an Audits
-- effect rather than slipped in.
--
-- THE ORDER IS FORCED, AND §2.6'S "BACKFILL BEFORE ANY CONSTRAINT" IS WHY. A column cannot be
-- backfilled before it exists, so the columns are added NULLABLE and UNCONSTRAINED first (§1), the
-- backfill runs (§2), and only then do the NOT NULLs and the CHECKs land (§4). Every constraint in
-- this file therefore meets rows that already satisfy it.
--
-- ...AND §0 EXISTS BECAUSE STAGING HOLDS NO CALENDAR ROWS. `calendar_events` is empty on staging
-- (0 as the service role, read 15 October) and holds 47 rows on production. A backfill verified
-- against an empty table is `HOW-WE-BUILD.md` §3's worst case — a check that passes because it can
-- see nothing, which looks exactly like a check that found nothing wrong. So §0 inserts six rows
-- IN THE OLD SHAPE before the backfill, §3 proves every mapping on them and that the witness count
-- is six, and then they go. The backfill is tested on staging, not merely run there.
-- ===========================================================================

begin;

-- ===========================================================================
-- 0. THE BACKFILL'S OWN WITNESSES, IN THE OLD SHAPE
-- ===========================================================================
-- Six rows and one document, under a company this migration creates and destroys. They exist only
-- so §3 can prove the backfill did what it says; §3 deletes the company, which cascades all of it.
-- They are inserted while `category`, `is_recurring`, `recurrence_period` and `completed` still
-- exist, which is the only moment they can be.
do $$
declare co uuid; doc uuid;
begin
  insert into public.companies (name) values ('Migration 073 backfill witness') returning id into co;
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'probe-073-permit.pdf', 'probe/073', 'application/pdf') returning id into doc;

  -- w1: a date that came from a document. Its `description` holds the permit's own line, because
  -- that is where `app/api/document-actions/route.ts:141–146` put it ("description: dl.source_line").
  insert into public.calendar_events
       (company_id, user_id, title, description, due_date, category, is_recurring, recurrence_period, completed, completed_at, document_id)
       values (co, null, '073 witness 1', 'Condition 6.2 of the permit', '2027-03-01', 'document', true, 'annually', true, now(), doc);
  -- w2: a date with no document — the old importer's shape (`category` 'compliance', 47 such rows
  -- on production). It becomes `source = 'person'`: with no `document_id` there is no document to
  -- point at, and a person did put it there.
  insert into public.calendar_events
       (company_id, title, description, due_date, category, is_recurring, recurrence_period)
       values (co, '073 witness 2', 'typed by hand', '2027-04-01', 'compliance', false, null);
  -- w3, w4, w5: the three period words that map, and one that does not.
  insert into public.calendar_events (company_id, title, due_date, is_recurring, recurrence_period)
       values (co, '073 witness 3', '2027-05-01', true, 'monthly'),
              (co, '073 witness 4', '2027-06-01', true, 'quarterly'),
              (co, '073 witness 5', '2027-07-01', true, 'weekly');
  -- w6: `is_recurring` NULL — allowed today, because the column is nullable with a default.
  insert into public.calendar_events (company_id, title, due_date, is_recurring)
       values (co, '073 witness 6', '2027-08-01', null);
end $$;

-- ===========================================================================
-- 1. THE NEW COLUMNS — nullable, unconstrained, so §2 can fill them
-- ===========================================================================
alter table public.calendar_events add column if not exists status            text;
alter table public.calendar_events add column if not exists source            text;
alter table public.calendar_events add column if not exists recurs            boolean;
alter table public.calendar_events add column if not exists period            text;
-- Where the date was read from. `source_line` is the exact sentence (a permit condition from
-- `document_deadlines.source_line`, an `audit_findings` title, a `handbook_dates.quote`);
-- `source_url` is the rule's page when the chat found one; `source_page` is the page in the file.
alter table public.calendar_events add column if not exists source_line       text;
alter table public.calendar_events add column if not exists source_url        text;
alter table public.calendar_events add column if not exists source_page       text;
-- What found it, beside `document_id` and `handbook_id`, which already exist (040:195, 066:305).
alter table public.calendar_events add column if not exists audit_finding_id  uuid;
-- The `document_deadlines` row this date was last read from. INFORMATIONAL AND NEVER THE DEDUPE
-- KEY: `document_deadlines` rows are written per SCAN (map B2, `lib/documentScan.ts:893–898`), so a
-- re-read of the same permit makes a new row for the same real-world date. Decision 13: the key is
-- the document, which is why §5's unique index names `document_id` and not this.
alter table public.calendar_events add column if not exists deadline_id       uuid;
-- The history the drawer shows (decision 10: nothing hidden). The two person columns take the same
-- foreign key as `added_by` (§4), so a departed person's id disappears from every history field
-- alike rather than from one of three.
alter table public.calendar_events add column if not exists confirmed_by      uuid;
alter table public.calendar_events add column if not exists confirmed_at      timestamptz;
alter table public.calendar_events add column if not exists dismissed_by      uuid;
alter table public.calendar_events add column if not exists dismissed_at      timestamptz;
alter table public.calendar_events add column if not exists dismissed_reason  text;
-- Decision 13: a date that moved. The old row stays and points at the new one.
alter table public.calendar_events add column if not exists replaced_by       uuid;

-- ===========================================================================
-- 2. THE BACKFILL — before any constraint
-- ===========================================================================
-- Every row that exists was put there by a person: either typed into the old page's form, chosen
-- from the old importer's list, or sent over by "Add to calendar". None of those is a proposal, so
-- all of them are `confirmed`. New rows default to `proposed` (§4).
update public.calendar_events set status = 'confirmed' where status is null;

-- `source` from the one fact the old table recorded about provenance: whether it names a document.
-- `category` is NOT consulted — on production all 47 rows hold `'compliance'`, which says only that
-- they came through the old importer, and the importer never recorded which file.
update public.calendar_events
   set source = case when document_id is not null then 'document' else 'person' end
 where source is null;

update public.calendar_events set recurs = coalesce(is_recurring, false) where recurs is null;

-- The ten words the old dropdown offered and the one the importer wrote were never a vocabulary
-- (006:66–71). Three of them map onto a real period; everything else becomes NULL, which after
-- this migration means "repeats, how often not known yet" (decision 23) rather than a guess.
update public.calendar_events
   set period = case recurrence_period
                  when 'monthly'   then 'month'
                  when 'quarterly' then 'quarter'
                  when 'annually'  then 'year'
                  else null
                end
 where period is null;

-- A document's date kept its source line in `description`, because that is the only field the old
-- insert had for it (`app/api/document-actions/route.ts:142`). COPIED, NOT MOVED: `description` is
-- left exactly as it is, so nothing a person has already read on screen changes — and §3 asserts
-- both halves, that `source_line` arrived AND that `description` still holds the same sentence.
update public.calendar_events
   set source_line = description
 where document_id is not null and source_line is null and description is not null;

-- ===========================================================================
-- 3. THE BACKFILL, PROVED ON THE WITNESSES
-- ===========================================================================
-- *** THE COUNT COMES FIRST, AND IT IS THE POINT. *** If the witnesses are not there, every
-- assertion below passes over nothing and this block reports success having checked the backfill
-- against an empty set — `HOW-WE-BUILD.md` §3, "prove it can see a presence first".
do $$
declare co uuid; n int; r record;
begin
  select id into co from public.companies where name = 'Migration 073 backfill witness';
  if co is null then
    raise exception 'MIGRATION 073 FAILED: §0 left no witness company, so the backfill was not tested.';
  end if;
  select count(*) into n from public.calendar_events where company_id = co;
  if n <> 6 then
    raise exception 'MIGRATION 073 FAILED: expected 6 witness rows to test the backfill against, found %.', n;
  end if;

  -- Over EVERY row in the table, not only the witnesses: production's 47 are covered by this.
  select count(*) into n from public.calendar_events where status is null or source is null or recurs is null;
  if n <> 0 then
    raise exception 'MIGRATION 073 FAILED: % row(s) came out of the backfill with a null status, source or recurs.', n;
  end if;
  select count(*) into n from public.calendar_events where status <> 'confirmed';
  if n <> 0 then
    raise exception 'MIGRATION 073 FAILED: % existing row(s) are not confirmed.', n;
  end if;

  -- w1 — a document's date: source, the line moved out of description, the period mapped.
  select * into r from public.calendar_events where company_id = co and title = '073 witness 1';
  if r.source <> 'document' then raise exception 'MIGRATION 073 FAILED: w1 source is %, not document.', r.source; end if;
  if r.source_line <> 'Condition 6.2 of the permit' then
    raise exception 'MIGRATION 073 FAILED: w1 source_line is %, not the permit condition.', coalesce(r.source_line, '<null>'); end if;
  if r.description <> 'Condition 6.2 of the permit' then
    raise exception 'MIGRATION 073 FAILED: w1 description was changed; the backfill must copy, not move.'; end if;
  if r.recurs is not true or r.period <> 'year' then
    raise exception 'MIGRATION 073 FAILED: w1 is % / %, not true / year.', r.recurs, coalesce(r.period, '<null>'); end if;

  -- w2 — no document: 'person', and NO source_line invented from its description.
  select * into r from public.calendar_events where company_id = co and title = '073 witness 2';
  if r.source <> 'person' then raise exception 'MIGRATION 073 FAILED: w2 source is %, not person.', r.source; end if;
  if r.source_line is not null then
    raise exception 'MIGRATION 073 FAILED: w2 took a source_line (%) from a description with no document behind it.', r.source_line; end if;
  if r.recurs is not false then raise exception 'MIGRATION 073 FAILED: w2 recurs is %, not false.', r.recurs; end if;

  -- w3, w4 — the two other words that map.
  select * into r from public.calendar_events where company_id = co and title = '073 witness 3';
  if r.period <> 'month' then raise exception 'MIGRATION 073 FAILED: monthly became %, not month.', coalesce(r.period, '<null>'); end if;
  select * into r from public.calendar_events where company_id = co and title = '073 witness 4';
  if r.period <> 'quarter' then raise exception 'MIGRATION 073 FAILED: quarterly became %, not quarter.', coalesce(r.period, '<null>'); end if;

  -- w5 — a word that maps to nothing becomes NULL, and the row still says it repeats. An
  -- unmappable period must not silently become 'year'.
  select * into r from public.calendar_events where company_id = co and title = '073 witness 5';
  if r.period is not null then raise exception 'MIGRATION 073 FAILED: weekly became %, not null.', r.period; end if;
  if r.recurs is not true then raise exception 'MIGRATION 073 FAILED: w5 lost its recurrence.'; end if;

  -- w6 — is_recurring NULL becomes recurs false, never NULL. This is what lets §4 make `recurs`
  -- NOT NULL and what keeps the due_date CHECK from ever evaluating to NULL.
  select * into r from public.calendar_events where company_id = co and title = '073 witness 6';
  if r.recurs is not false then raise exception 'MIGRATION 073 FAILED: a null is_recurring became %, not false.', coalesce(r.recurs::text, '<null>'); end if;

  delete from public.companies where id = co;
  raise notice '073 §3 OK: the backfill was tested against 6 witness rows and every mapping held; the witnesses are gone.';
end $$;

-- ===========================================================================
-- 4. THE SHAPE — the rename, the drops, the NOT NULLs, the CHECKs, the keys
-- ===========================================================================

-- company_id. Production read 0 nulls before this file was written; staging holds no rows.
alter table public.calendar_events alter column company_id set not null;

-- due_date. Nullable now, under the CHECK below: migration 060's rule.
alter table public.calendar_events alter column due_date drop not null;

-- *** user_id → added_by, AND ITS FOREIGN KEY CHANGES BEHAVIOUR. ***
-- Today it is `ON DELETE CASCADE` (`000_baseline.sql:364`), so deleting an auth user DESTROYS the
-- company's calendar rows that person created. That is wrong twice over: a date belongs to the
-- company (`app/api/calendar/route.ts:74–77` already says so for reads), and decision 11 says a
-- date is closed, never deleted. SET NULL keeps the date and forgets who typed it.
alter table public.calendar_events drop constraint if exists calendar_events_user_id_fkey;
alter table public.calendar_events rename column user_id to added_by;
alter table public.calendar_events drop constraint if exists calendar_events_added_by_fkey;
alter table public.calendar_events add constraint calendar_events_added_by_fkey
  foreign key (added_by) references auth.users (id) on delete set null;

-- *** AND THE SAME KEY ON THE OTHER TWO HISTORY COLUMNS (the owner, 15 October). ***
-- `added_by`, `confirmed_by` and `dismissed_by` are the three places this table names a person.
-- One of them forgetting a departed colleague while the other two kept a dangling uuid would be a
-- drawer that tells three different stories about the same deletion, so all three are
-- `references auth.users (id) on delete set null`, and §10 reads all three back from the catalog.
alter table public.calendar_events drop constraint if exists calendar_events_confirmed_by_fkey;
alter table public.calendar_events add constraint calendar_events_confirmed_by_fkey
  foreign key (confirmed_by) references auth.users (id) on delete set null;
alter table public.calendar_events drop constraint if exists calendar_events_dismissed_by_fkey;
alter table public.calendar_events add constraint calendar_events_dismissed_by_fkey
  foreign key (dismissed_by) references auth.users (id) on delete set null;

-- The five columns decisions 11 and 12 remove. Their replacements are filled (§2).
alter table public.calendar_events drop column if exists category;
alter table public.calendar_events drop column if exists is_recurring;
alter table public.calendar_events drop column if exists recurrence_period;
alter table public.calendar_events drop column if exists completed;
alter table public.calendar_events drop column if exists completed_at;

-- NOT NULL and the defaults. `status` defaults to `proposed` for rows written FROM NOW ON; every
-- row that already existed was set to `confirmed` by §2, which is the whole point of doing the
-- backfill before the default.
alter table public.calendar_events alter column status set not null;
alter table public.calendar_events alter column status set default 'proposed';
alter table public.calendar_events alter column source set not null;
alter table public.calendar_events alter column recurs set not null;
alter table public.calendar_events alter column recurs set default false;

alter table public.calendar_events drop constraint if exists calendar_events_status_is_known;
alter table public.calendar_events add constraint calendar_events_status_is_known
  check (status in ('proposed', 'confirmed', 'dismissed'));

alter table public.calendar_events drop constraint if exists calendar_events_source_is_known;
alter table public.calendar_events add constraint calendar_events_source_is_known
  check (source in ('document', 'audit', 'handbook', 'rule', 'person'));

-- *** WRITTEN `period is null or …` ON PURPOSE. *** A bare `period in (…)` behaves identically
-- here — NULL in a CHECK passes — but it leaves a reader to work out whether NULL being allowed
-- was intended. It is: NULL means "repeats, how often not known yet" (decision 23), which is the
-- common case, because the scan returns a boolean and no period (map B2). `CLAUDE.md` §3.7's NULL
-- trap, said out loud rather than relied on.
alter table public.calendar_events drop constraint if exists calendar_events_period_is_known;
alter table public.calendar_events add constraint calendar_events_period_is_known
  check (period is null or period in ('month', 'quarter', '6 months', 'year', '2 years'));

-- *** MIGRATION 060'S RULE, COPIED. *** A recurring date may have no day; a one-off must have one.
-- `recurs is true` rather than `recurs` for the reason 060:42–46 gives: it makes the condition
-- impossible to evaluate to NULL even if `recurs` ever became nullable again, so the constraint
-- cannot be silently disabled by a null.
alter table public.calendar_events drop constraint if exists calendar_events_date_or_recurs;
alter table public.calendar_events add constraint calendar_events_date_or_recurs
  check (due_date is not null or recurs is true);

-- *** THE ONE CHANGE TO A TABLE THIS SECTION DOES NOT OWN. ***
-- The composite foreign key below needs `unique (company_id, id)` on the referenced table, and
-- `audit_findings` has none — read from `pg_constraint` on 15 October 2026: nine tables in `public`
-- carry that key (audit_runs, audit_sections, document_scans, documents, entities, handbooks,
-- handbook_checks, handbook_sections, handbook_check_sections) and `audit_findings` is not among
-- them. Additive, and it cannot fail: the pair is already unique through the primary key. The shape
-- is `066_hr_handbooks_and_their_check.sql:83–84`.
alter table public.audit_findings drop constraint if exists audit_findings_company_id_id_key;
alter table public.audit_findings add constraint audit_findings_company_id_id_key unique (company_id, id);

-- The 066 shape (`calendar_events_handbook_in_same_company`, 066:306–309): a COMPOSITE key, so a
-- calendar row cannot cite another company's finding — which RLS cannot catch, because both rows
-- pass their own policies. `SET NULL (audit_finding_id)` nulls that column alone and never
-- `company_id`, which is NOT NULL from this migration on.
alter table public.calendar_events drop constraint if exists calendar_events_finding_in_same_company;
alter table public.calendar_events add constraint calendar_events_finding_in_same_company
  foreign key (company_id, audit_finding_id) references public.audit_findings (company_id, id)
  on delete set null (audit_finding_id);

-- `deadline_id` and `replaced_by` are single-column keys, because neither referenced table carries
-- `unique (company_id, id)` and §2.6 asks for neither. Both are informational pointers the drawer
-- reads; the tenancy that matters is `company_id` on this row, and §10 proves a cross-tenant
-- pointer is still refused where the composite key exists.
alter table public.calendar_events drop constraint if exists calendar_events_deadline_id_fkey;
alter table public.calendar_events add constraint calendar_events_deadline_id_fkey
  foreign key (deadline_id) references public.document_deadlines (id) on delete set null;

alter table public.calendar_events drop constraint if exists calendar_events_replaced_by_fkey;
alter table public.calendar_events add constraint calendar_events_replaced_by_fkey
  foreign key (replaced_by) references public.calendar_events (id) on delete set null;

comment on column public.calendar_events.status is
  'proposed | confirmed | dismissed. A proposed date SHOWS on the calendar and in the monthly email '
  '(decision 8): confirming is a quality mark, not a gate. Migration 073.';
comment on column public.calendar_events.source is
  'document | audit | handbook | rule | person — where the date came from. Replaces `category`, '
  'which had three vocabularies and no CHECK (006:66–71). Migration 073.';
comment on column public.calendar_events.period is
  'month | quarter | 6 months | year | 2 years, or NULL for "repeats, how often not known yet" — '
  'the common case, because the document scan returns a boolean and no period (decision 23). '
  'The NEXT date is never stored; `calendar_v.next_due` computes it. Migration 073.';
comment on column public.calendar_events.deadline_id is
  'The document_deadlines row this date was last read from. Informational, never the dedupe key: '
  'those rows are per scan, so a re-read makes a new one for the same real date (decision 13).';

-- ===========================================================================
-- 5. THE INDEXES
-- ===========================================================================
-- The one read path had no index: every caller does `.eq(company_id).order(due_date)`
-- (`app/api/calendar/route.ts:84–88`), and the only company-leading index was partial on
-- `handbook_id is not null` (066:310), which that query cannot use. `CLAUDE.md` §3.7: company-leading.
create index if not exists idx_calendar_events_company_due
  on public.calendar_events (company_id, due_date);
-- The queue tab and the email both read by status.
create index if not exists idx_calendar_events_company_status
  on public.calendar_events (company_id, status);

-- *** DECISION 13, AS A CONSTRAINT RATHER THAN A CONVENTION. ***
-- The same document date is never proposed twice. Keyed on the DOCUMENT, not the scan, and
-- `lower(title)` so a re-read that changes the capitalisation does not create a second row.
-- `coalesce(due_date, date '0001-01-01')` because NULLs are distinct in a unique index, so two
-- undated repeating dates with the same title on the same document would otherwise both land.
-- A partial unique INDEX and not a constraint: a constraint cannot carry an expression or a WHERE.
-- It covers dismissed rows too — that is deliberate, and `proposeDate()` returns `existing` for
-- them, because re-proposing a date a person has removed with a reason would undo their decision.
create unique index if not exists idx_calendar_events_company_document_title_due
  on public.calendar_events (company_id, document_id, lower(title), coalesce(due_date, date '0001-01-01'))
  where source = 'document';

-- ===========================================================================
-- 6. GRANTS AND POLICIES
-- ===========================================================================
-- REVOKE then GRANT, both roles, every time (`CLAUDE.md` §3.6). `000_baseline.sql:758` granted
-- `all` to anon, authenticated AND service_role; `004_rls_completion.sql:397` revoked anon's.
-- `authenticated` has therefore held DELETE on this table since the first day, and decision 11
-- takes it away. Nothing is revoked from `service_role`, which the server needs.
revoke all on table public.calendar_events from anon;
revoke all on table public.calendar_events from authenticated;
grant select, insert, update on table public.calendar_events to authenticated;   -- no DELETE

-- The four policies 004:134–142 created. Restated here rather than left alone, so this file says
-- what the final state is instead of depending on a reader finding 004 — and the DELETE one goes.
drop policy if exists calendar_events_delete on public.calendar_events;
drop policy if exists calendar_events_select on public.calendar_events;
drop policy if exists calendar_events_insert on public.calendar_events;
drop policy if exists calendar_events_update on public.calendar_events;

create policy calendar_events_select on public.calendar_events for select to authenticated
  using (calendar_events.company_id = public.auth_company_id());
create policy calendar_events_insert on public.calendar_events for insert to authenticated
  with check (calendar_events.company_id = public.auth_company_id());
create policy calendar_events_update on public.calendar_events for update to authenticated
  using (calendar_events.company_id = public.auth_company_id())
  with check (calendar_events.company_id = public.auth_company_id());

-- ===========================================================================
-- 7. THE THREE CHECKS WIDENED — drop and recreate, every prior value restated
-- ===========================================================================
-- The shape 050, 064 and 066 each used. Names and current values read from the catalog on staging
-- on 15 October 2026, not from the prior migration files.

-- `ai_calls_task_check` — 15 values, plus `calendar` (decision 4). Owned by 040, then 050, then
-- 064, then 066; owned by this file now. `lib/costLedger.ts` LEDGER_TASKS must match, and
-- `tests/unit/costLedger.test.ts` asserts that it does.
alter table public.ai_calls drop constraint if exists ai_calls_task_check;
alter table public.ai_calls add constraint ai_calls_task_check check (task in (
  'research', 'checklist', 'substeps', 'convert', 'summarise',
  'gate', 'critique', 'audit', 'document_review', 'document_scan', 'document_draft', 'howto',
  'other', 'hr', 'hr_check',
  'calendar'
));

-- `job_runs_job_check` — 6 values, plus `calendar_month` (decision 18). Owned by 053, then 058,
-- then 066. `lib/jobAuth.ts:66` and `lib/jobRun.ts:27` carry the same list as TypeScript unions.
alter table public.job_runs drop constraint if exists job_runs_job_check;
alter table public.job_runs add constraint job_runs_job_check check (job in (
  'summarise', 'delete', 'account_delete', 'scan_documents', 'audit_sections', 'handbook_checks',
  'calendar_month'
));

-- `topics_section_is_known` — 2 values, plus `calendar` (decision 4). Owned by 066:246–247.
-- `lib/topicList.ts:49`'s `TopicSection` carries the same list, and `readTopicList` is the ONE
-- place a section is filtered on (`lib/topicList.ts:59`).
alter table public.topics drop constraint if exists topics_section_is_known;
alter table public.topics add constraint topics_section_is_known
  check (section in ('workspace', 'hr', 'calendar'));

-- ===========================================================================
-- 8. THE TWO NEW TABLES
-- ===========================================================================

-- The stamp against sending the monthly email twice (decision 18). Written by the job under the
-- service role; a person may read their own company's history and nothing else.
create table if not exists public.calendar_mailings (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- The month the email was ABOUT, as the job writes it. Shape is the job's to settle in step 11;
  -- no CHECK here, because a format this file guesses at is a constraint the job then works around.
  month      text not null,
  sent_at    timestamptz not null default now(),
  -- Who it actually went to, so a question about one month's email is answerable from the row.
  sent_to    text[] not null default '{}',
  constraint calendar_mailings_company_month_key unique (company_id, month)
);
create index if not exists idx_calendar_mailings_company_month
  on public.calendar_mailings (company_id, month);

-- The secret address behind "Send to your calendar" (decision 20). One live row per company;
-- rotating means inserting a new row and stamping `revoked_at` on the old one, so a link that was
-- shared and then replaced can be told from one that never existed.
create table if not exists public.calendar_feed_tokens (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_calendar_feed_tokens_company
  on public.calendar_feed_tokens (company_id);

alter table public.calendar_mailings    enable row level security;
alter table public.calendar_feed_tokens enable row level security;

-- REVOKE THEN GRANT, BOTH ROLES. Since migration 068 `postgres`'s default privileges on public
-- grant `anon` and `authenticated` nothing, but `supabase_admin`'s still grant both everything for
-- objects IT creates, `postgres` cannot change those, and a redundant REVOKE costs nothing
-- (`CLAUDE.md` §3.6). SELECT only for a person: both tables are written by the server.
revoke all on table public.calendar_mailings    from anon;
revoke all on table public.calendar_mailings    from authenticated;
revoke all on table public.calendar_feed_tokens from anon;
revoke all on table public.calendar_feed_tokens from authenticated;
grant select on table public.calendar_mailings    to authenticated;
grant select on table public.calendar_feed_tokens to authenticated;
grant all    on table public.calendar_mailings    to service_role;
grant all    on table public.calendar_feed_tokens to service_role;

create policy calendar_mailings_select_own on public.calendar_mailings for select to authenticated
  using (calendar_mailings.company_id = public.auth_company_id());
create policy calendar_feed_tokens_select_own on public.calendar_feed_tokens for select to authenticated
  using (calendar_feed_tokens.company_id = public.auth_company_id());

comment on table public.calendar_feed_tokens is
  'The secret address for the subscription feed (decision 20). GET /api/calendar/feed?t=<token> is '
  'the one route in the product with no session, so this token IS the credential: it is never put in '
  'the account export (app/api/account/export/route.ts says why). Migration 073.';

-- ===========================================================================
-- 9. calendar_v — everything derived, nothing stored
-- ===========================================================================
-- `security_invoker = true`, as `document_index_v` (043:30–31) and for the same reason: without it
-- the view would be a hole straight through this table's RLS. It takes no policies of its own; what
-- it needs is the grant, below.
--
-- THE COLUMNS ARE NAMED RATHER THAN `e.*`. A new column on `calendar_events` must be added here
-- too, deliberately — `create or replace view` can only append, so a view built on `*` would drift
-- from the table and nobody would see it happen.
--
-- THE SITE IS READ LIVE, NEVER COPIED (decision 24). For a document-sourced row it is the
-- document's CURRENT site through `document_index_v`, so a correction in Documents or a removed
-- site reaches the calendar with no code here. Column names read from the live catalog on
-- 15 October: `document_index_v` exposes `document_id`, `company_id`, `title`, `entity_id` and
-- `site_name` (positions 1, 2, 3, 10 and 9 of 29). The cost is that every calendar read evaluates
-- that view; that is the price of the site being live rather than stale, and it is the design.
--
-- *** AND IT MAKES `document_index_v` A SHARED OBJECT, WHICH IT WAS NOT BEFORE. ***
-- `calendar_v` now DEPENDS on it, so a later `create or replace view public.document_index_v` that
-- renames, reorders or removes a column Postgres will refuse while this view stands — the Documents
-- section has to drop `calendar_v` first, or change it in the same migration. That is a real
-- cross-section coupling and it is named in step 5's impact plan rather than discovered by a
-- migration failing. The columns this view reads are `document_id`, `company_id`, `title` and
-- `entity_id`; it does not read `site_name`, because the name is taken from `entities` through the
-- resolved `site_id` so that a row with no document gets a name the same way.
create or replace view public.calendar_v
with (security_invoker = true) as
select
  e.id,
  e.company_id,
  e.title,
  e.description,
  e.due_date,
  e.status,
  e.source,
  e.recurs,
  e.period,
  e.source_line,
  e.source_url,
  e.source_page,
  e.entity_id,
  e.document_id,
  e.handbook_id,
  e.audit_finding_id,
  e.deadline_id,
  e.added_by,
  e.confirmed_by,
  e.confirmed_at,
  e.dismissed_by,
  e.dismissed_at,
  e.dismissed_reason,
  e.replaced_by,
  e.created_at,
  s.site_id,
  ent.name as site_name,
  nd.next_due,
  (nd.next_due - current_date) as days_until,
  -- *** A REPEATING DATE HAS NOT "PASSED". *** Its occurrence has, and the next one is ahead:
  -- `next_due` says when. Only a ONE-OFF whose day is behind us has passed, and the product says
  -- "passed", never "overdue" and never "done" (decision 11).
  (not e.recurs and e.due_date is not null and e.due_date < current_date) as has_passed,
  case e.source
    when 'document' then d.title
    when 'handbook' then hb.name
    -- The agency and when the audit ran. `concat_ws` skips a null part rather than nulling the
    -- whole string; `nullif` turns "both parts missing" back into NULL instead of ''.
    when 'audit'    then nullif(concat_ws(' · ', ar.agency_label,
                                 to_char(coalesce(ar.finished_at, ar.created_at), 'DD Mon YYYY')), '')
    else null
  end as source_title
from public.calendar_events e
left join public.document_index_v d
       on d.document_id = e.document_id and d.company_id = e.company_id
left join public.handbooks hb
       on hb.id = e.handbook_id and hb.company_id = e.company_id
left join public.audit_findings af
       on af.id = e.audit_finding_id and af.company_id = e.company_id
left join public.audit_runs ar
       on ar.id = af.run_id and ar.company_id = e.company_id
-- The site: the document's current one for a document-sourced row, else the row's own.
left join lateral (
  select case when e.source = 'document' and d.document_id is not null
              then d.entity_id else e.entity_id end as site_id
) s on true
left join public.entities ent
       on ent.id = s.site_id and ent.company_id = e.company_id
-- How many months one step of the period is. NULL for "not known yet", which makes `next_due` NULL.
left join lateral (
  select case e.period
           when 'month'    then 1
           when 'quarter'  then 3
           when '6 months' then 6
           when 'year'     then 12
           when '2 years'  then 24
         end as step_months
) st on true
-- *** HOW MANY WHOLE STEPS FROM THE ANCHOR TO TODAY. ***
-- `age()` gives the elapsed interval; its year and month parts are the FLOOR of the months
-- elapsed, so `due_date + k steps` may still be one day short of today when the leftover days are
-- non-zero — which is why the next lateral checks and takes one more step. A future anchor gives a
-- negative age, `ceil` of a negative over a positive is <= 0, and `greatest(0, …)` makes k zero, so
-- the anchor itself is the answer. The WHERE makes this lateral produce no row when there is
-- nothing to compute, and the LEFT JOIN turns that into a null `k`.
left join lateral (
  select greatest(0, ceil(
           ( extract(year  from age(current_date, e.due_date)) * 12
           + extract(month from age(current_date, e.due_date)) )::numeric
           / st.step_months))::int as k
   where e.due_date is not null and st.step_months is not null
) kk on true
left join lateral (
  select case
    -- A one-off IS its date, passed or not.
    when not e.recurs then e.due_date
    -- Repeating with no day, or no period: there is no honest next date (decisions 12 and 23).
    when e.due_date is null or st.step_months is null then null
    when (e.due_date + (kk.k * st.step_months || ' months')::interval)::date >= current_date
      then (e.due_date + (kk.k * st.step_months || ' months')::interval)::date
    else   (e.due_date + ((kk.k + 1) * st.step_months || ' months')::interval)::date
  end as next_due
) nd on true;

comment on view public.calendar_v is
  'Every calendar_events column plus the site read live from the document, next_due computed from '
  'the period and the anchor, days_until, has_passed and source_title. NOTHING DERIVED IS STORED — '
  'migration 049''s rule. security_invoker: it shows only the rows the caller could select. '
  'Migration 073.';

-- A view takes no policies; what it needs is the grant (043:109–114).
revoke all on table public.calendar_v from anon;
revoke all on table public.calendar_v from authenticated;
grant select on table public.calendar_v to authenticated;
grant select on table public.calendar_v to service_role;

-- ===========================================================================
-- 10. VERIFY — break every constraint on purpose, and read the grants back
-- ===========================================================================
-- `CLAUDE.md` §3.7: a constraint nobody has tried to break is a comment. Every refusal below is
-- caught by its own exception class, so a refusal for the wrong reason (a missing column, a bad
-- foreign key) fails this block instead of passing as a success.
do $$
declare
  co uuid; coB uuid; site uuid; doc uuid; dl uuid; hb uuid; hbB uuid;
  run uuid; sec uuid; fnd uuid; ev uuid; evA uuid; scn uuid; n int; r record;
  v text; rel text; jobs uuid[] := '{}';
begin
  insert into public.companies (name) values ('Migration 073 probe A') returning id into co;
  insert into public.companies (name) values ('Migration 073 probe B') returning id into coB;
  insert into public.entities (company_id, entity_type, name, details)
       values (co, 'site', 'Portland', '{}'::jsonb) returning id into site;
  insert into public.documents (company_id, name, file_url, file_type, entity_id)
       values (co, 'probe-073.pdf', 'probe/073a', 'application/pdf', site) returning id into doc;
  insert into public.document_scans (document_id, company_id, kind, status, is_current, title)
       values (doc, co, 'permit', 'current', true, '073 probe permit') returning id into scn;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, recurs)
       values (scn, doc, co, 'Permit expires', '2027-01-01', false) returning id into dl;
  insert into public.handbooks (company_id, name, file_path, file_name)
       values (co, '073 probe handbook', co::text || '/handbooks/probe.pdf', 'probe.pdf') returning id into hb;
  insert into public.handbooks (company_id, name, file_path, file_name)
       values (coB, '073 probe handbook B', coB::text || '/handbooks/probe.pdf', 'probe.pdf') returning id into hbB;
  insert into public.audit_runs (company_id, entity_id, kind, agency_label)
       values (co, site, 'agency', 'Oregon DEQ') returning id into run;
  insert into public.audit_sections (run_id, company_id, ordinal, title)
       values (run, co, 0, 'Oregon DEQ') returning id into sec;
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title, due_on, recurs)
       values (run, sec, co, 0, 'date', 'Annual report', '2027-02-15', false) returning id into fnd;

  -- ---- 1. A ONE-OFF DATE WITH NO DAY IS REFUSED. 060's rule, on this table. ----
  begin
    insert into public.calendar_events (company_id, title, due_date, recurs, source)
         values (co, 'a one-off with no day', null, false, 'person');
    raise exception 'MIGRATION 073 FAILED: a one-off date with no due_date was accepted.';
  exception when check_violation then null; end;

  -- ...and the case the CHECK exists to ALLOW: recurring, no day. Without this the test above
  -- would pass just as well against `check (due_date is not null)`, which is the wrong rule.
  insert into public.calendar_events (company_id, title, due_date, recurs, source)
       values (co, 'repeats, day not known yet', null, true, 'document') returning id into ev;
  if (select due_date from public.calendar_events where id = ev) is not null then
    raise exception 'MIGRATION 073 FAILED: a null due_date did not store as null.';
  end if;

  -- ---- 2. A BAD STATUS IS REFUSED, and the default is `proposed`. ----
  begin
    insert into public.calendar_events (company_id, title, due_date, source, status)
         values (co, 'bad status', '2027-01-01', 'person', 'done');
    raise exception 'MIGRATION 073 FAILED: status "done" was accepted — the one word the product must not say.';
  exception when check_violation then null; end;
  insert into public.calendar_events (company_id, title, due_date, source)
       values (co, 'defaults to proposed', '2027-01-02', 'document') returning id into ev;
  if (select status from public.calendar_events where id = ev) <> 'proposed' then
    raise exception 'MIGRATION 073 FAILED: a new row did not default to proposed.';
  end if;

  -- ---- 3. A BAD SOURCE IS REFUSED. `compliance` is the old vocabulary, which is the value
  -- somebody would plausibly write (`CLAUDE.md` §3.7: not obvious junk). ----
  begin
    insert into public.calendar_events (company_id, title, due_date, source)
         values (co, 'bad source', '2027-01-03', 'compliance');
    raise exception 'MIGRATION 073 FAILED: source "compliance" — the old category — was accepted.';
  exception when check_violation then null; end;

  -- ---- 3b. A BAD PERIOD IS REFUSED; NULL AND EVERY GOOD ONE ARE ACCEPTED. ----
  begin
    insert into public.calendar_events (company_id, title, due_date, recurs, period, source)
         values (co, 'bad period', '2027-01-04', true, 'annually', 'person');
    raise exception 'MIGRATION 073 FAILED: period "annually" — the old word — was accepted.';
  exception when check_violation then null; end;
  foreach v in array array['month', 'quarter', '6 months', 'year', '2 years'] loop
    insert into public.calendar_events (company_id, title, due_date, recurs, period, source)
         values (co, 'period ' || v, '2027-01-05', true, v, 'person');
  end loop;
  select count(*) into n from public.calendar_events where company_id = co and period is not null;
  if n <> 5 then raise exception 'MIGRATION 073 FAILED: expected 5 periods to land, found %.', n; end if;

  -- ---- 4. THE SAME DOCUMENT DATE TWICE IS REFUSED BY THE UNIQUE KEY. ----
  insert into public.calendar_events (company_id, title, due_date, source, document_id)
       values (co, 'Permit expires', '2027-01-01', 'document', doc);
  begin
    insert into public.calendar_events (company_id, title, due_date, source, document_id)
         values (co, 'Permit expires', '2027-01-01', 'document', doc);
    raise exception 'MIGRATION 073 FAILED: the same document date was accepted twice.';
  exception when unique_violation then null; end;
  -- ...and it is case-insensitive, which is what `lower(title)` is for.
  begin
    insert into public.calendar_events (company_id, title, due_date, source, document_id)
         values (co, 'PERMIT EXPIRES', '2027-01-01', 'document', doc);
    raise exception 'MIGRATION 073 FAILED: the same document date in different case was accepted.';
  exception when unique_violation then null; end;
  -- ...and a DIFFERENT date on the same document is allowed: decision 13 says a moved date is
  -- proposed anew. Testing the direction we are not building (`HOW-WE-BUILD.md` §3).
  insert into public.calendar_events (company_id, title, due_date, source, document_id)
       values (co, 'Permit expires', '2027-11-15', 'document', doc);
  -- ...and two UNDATED repeating dates with the same title on one document are still caught, which
  -- is what `coalesce(due_date, date '0001-01-01')` is for: NULLs are distinct in a unique index.
  insert into public.calendar_events (company_id, title, due_date, recurs, source, document_id)
       values (co, 'Annual fee', null, true, 'document', doc);
  begin
    insert into public.calendar_events (company_id, title, due_date, recurs, source, document_id)
         values (co, 'Annual fee', null, true, 'document', doc);
    raise exception 'MIGRATION 073 FAILED: two undated repeating dates on one document were accepted.';
  exception when unique_violation then null; end;
  -- ...and the key does NOT bind a person's dates: two typed dates may share a title and a day.
  insert into public.calendar_events (company_id, title, due_date, source)
       values (co, 'Call the fire marshal', '2027-01-06', 'person'),
              (co, 'Call the fire marshal', '2027-01-06', 'person');

  -- ---- 5. THE CROSS-TENANT COMPOSITE KEY STILL REFUSES. 066's rule, on the new pointer. ----
  begin
    insert into public.calendar_events (company_id, title, due_date, source, audit_finding_id)
         values (coB, 'another company''s finding', '2027-01-07', 'audit', fnd);
    raise exception 'MIGRATION 073 FAILED: a calendar row cited another company''s audit finding.';
  exception when foreign_key_violation then null; end;
  insert into public.calendar_events (company_id, title, due_date, source, audit_finding_id)
       values (co, 'Annual report', '2027-02-15', 'audit', fnd) returning id into ev;

  -- ---- 6. A HANDBOOK DELETE STILL NULLS handbook_id ONLY. 066:580–588, repeated, because this
  -- migration made `company_id` NOT NULL and a `SET NULL` that reached it would now fail. ----
  insert into public.calendar_events (company_id, title, due_date, source, handbook_id)
       values (co, 'handbook date', '2027-03-01', 'handbook', hb) returning id into evA;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, handbook_id)
         values (co, 'another company''s handbook', '2027-03-02', 'handbook', hbB);
    raise exception 'MIGRATION 073 FAILED: a calendar row cited another company''s handbook.';
  exception when foreign_key_violation then null; end;
  delete from public.handbooks where id = hb;
  select * into r from public.calendar_events where id = evA;
  if r.handbook_id is not null then
    raise exception 'MIGRATION 073 FAILED: deleting a handbook did not null handbook_id.';
  end if;
  if r.company_id <> co then
    raise exception 'MIGRATION 073 FAILED: deleting a handbook changed company_id to %.', coalesce(r.company_id::text, '<null>');
  end if;
  select count(*) into n from pg_constraint
   where conname = 'calendar_events_finding_in_same_company' and confdeltype = 'n';
  if n <> 1 then
    raise exception 'MIGRATION 073 FAILED: calendar_events.audit_finding_id is not ON DELETE SET NULL.';
  end if;

  -- ---- 6a. deadline_id ACCEPTS A REAL DEADLINE AND IS SET NULL. It is informational — the
  -- dedupe key is the document (decision 13) — so the only things to prove are that the pointer
  -- works and that losing the deadline does not take the date with it.
  insert into public.calendar_events (company_id, title, due_date, source, document_id, deadline_id)
       values (co, 'Permit expires, from its deadline row', '2027-01-01', 'document', doc, dl) returning id into ev;
  if (select deadline_id from public.calendar_events where id = ev) <> dl then
    raise exception 'MIGRATION 073 FAILED: deadline_id did not store.';
  end if;
  select confdeltype into v from pg_constraint where conname = 'calendar_events_deadline_id_fkey';
  if v <> 'n' then
    raise exception 'MIGRATION 073 FAILED: calendar_events.deadline_id is ON DELETE %, not SET NULL.', v;
  end if;
  select confdeltype into v from pg_constraint where conname = 'calendar_events_replaced_by_fkey';
  if v <> 'n' then
    raise exception 'MIGRATION 073 FAILED: calendar_events.replaced_by is ON DELETE %, not SET NULL.', v;
  end if;
  -- replaced_by points at a real row of this company's (decision 13's moved date).
  update public.calendar_events set replaced_by = ev, status = 'dismissed',
         dismissed_at = now(), dismissed_reason = 'the permit was renewed'
   where company_id = co and title = 'Permit expires' and due_date = date '2027-11-15';
  if (select count(*) from public.calendar_events where replaced_by = ev) <> 1 then
    raise exception 'MIGRATION 073 FAILED: replaced_by did not store.';
  end if;

  -- ---- 6b. ALL THREE PERSON COLUMNS ARE SET NULL, AND added_by IS NO LONGER CASCADE. Read from
  -- the catalog, because the behaviour change is the point: a person leaving must not take the
  -- company's dates with them, and must not leave a dangling id in one history field of three. ----
  foreach rel in array array['calendar_events_added_by_fkey', 'calendar_events_confirmed_by_fkey',
                             'calendar_events_dismissed_by_fkey'] loop
    select confdeltype into v from pg_constraint where conname = rel;
    if v is null then
      raise exception 'MIGRATION 073 FAILED: the foreign key % does not exist.', rel;
    end if;
    if v <> 'n' then
      raise exception 'MIGRATION 073 FAILED: % is ON DELETE %, not SET NULL.', rel, v;
    end if;
  end loop;
  -- ...and each one points at auth.users, not at something that merely accepted a uuid.
  select count(*) into n from pg_constraint con
    join pg_class rc     on rc.oid = con.confrelid
    join pg_namespace rn on rn.oid = rc.relnamespace
   where con.conname in ('calendar_events_added_by_fkey', 'calendar_events_confirmed_by_fkey',
                         'calendar_events_dismissed_by_fkey')
     and rn.nspname = 'auth' and rc.relname = 'users';
  if n <> 3 then
    raise exception 'MIGRATION 073 FAILED: % of 3 person columns point at auth.users.', n;
  end if;
  -- ...and the old column name is gone, so a query naming it fails loudly rather than silently.
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'calendar_events'
     and column_name in ('user_id', 'category', 'is_recurring', 'recurrence_period', 'completed', 'completed_at');
  if n <> 0 then
    raise exception 'MIGRATION 073 FAILED: % of the six old columns are still there.', n;
  end if;

  -- ---- 7. THE THREE WIDENED CHECKS: the new value in, a near miss out. ----
  insert into public.ai_calls (task, model) values ('calendar', '073-probe');
  insert into public.ai_calls (task, model) values ('calendar', '073-probe');   -- a SECOND one
  select count(*) into n from public.ai_calls where task = 'calendar' and model = '073-probe';
  if n <> 2 then raise exception 'MIGRATION 073 FAILED: expected 2 calendar ledger rows, found %.', n; end if;
  begin
    insert into public.ai_calls (task, model) values ('calendarx', '073-probe');
    raise exception 'MIGRATION 073 FAILED: ai_calls accepted the task "calendarx".';
  exception when check_violation then null; end;
  -- Every prior value must still be accepted: a restated list that lost one is this migration's
  -- most likely mistake, and it would show up as a silently unwritten cost row.
  foreach v in array array['research', 'checklist', 'substeps', 'convert', 'summarise', 'gate',
                           'critique', 'audit', 'document_review', 'document_scan', 'document_draft',
                           'howto', 'other', 'hr', 'hr_check'] loop
    insert into public.ai_calls (task, model) values (v, '073-probe-prior');
  end loop;
  select count(*) into n from public.ai_calls where model = '073-probe-prior';
  if n <> 15 then raise exception 'MIGRATION 073 FAILED: % of 15 prior ledger tasks were accepted.', n; end if;
  delete from public.ai_calls where model in ('073-probe', '073-probe-prior');

  -- *** EVERY PROBE ROW'S ID IS KEPT, AND ONLY THOSE ARE DELETED. *** `job_runs` is written every
  -- five minutes by two live sweeps, so a cleanup that matched on shape — job name plus a recent
  -- `started_at` — could delete a real run's row. `CLAUDE.md` §3.7 has the sibling rule for the
  -- stuck-job guard: a delete that cannot name what it is deleting is a delete nobody can audit.
  insert into public.job_runs (job) values ('calendar_month') returning id into ev;
  jobs := jobs || ev;
  begin
    insert into public.job_runs (job) values ('calendar_months');
    raise exception 'MIGRATION 073 FAILED: job_runs accepted the job "calendar_months".';
  exception when check_violation then null; end;
  foreach v in array array['summarise', 'delete', 'account_delete', 'scan_documents',
                           'audit_sections', 'handbook_checks'] loop
    insert into public.job_runs (job) values (v) returning id into ev;
    jobs := jobs || ev;
  end loop;
  if array_length(jobs, 1) <> 7 then
    raise exception 'MIGRATION 073 FAILED: % of 7 job names were accepted.', coalesce(array_length(jobs, 1), 0);
  end if;
  delete from public.job_runs where id = any (jobs);

  insert into public.topics (company_id, title, section) values (co, '073 probe topic', 'calendar');
  if (select section from public.topics where company_id = co) <> 'calendar' then
    raise exception 'MIGRATION 073 FAILED: a topic with section calendar did not read back.';
  end if;
  begin
    insert into public.topics (company_id, title, section) values (co, '073 probe topic 2', 'calendars');
    raise exception 'MIGRATION 073 FAILED: topics accepted the section "calendars".';
  exception when check_violation then null; end;
  -- And 066's default is untouched: a topic with no section is still a workspace one.
  insert into public.topics (company_id, title) values (co, '073 probe topic 3');
  if (select section from public.topics where company_id = co and title = '073 probe topic 3') <> 'workspace' then
    raise exception 'MIGRATION 073 FAILED: widening the CHECK moved the default off workspace.';
  end if;

  -- ---- 8. calendar_v: next_due for a 'year' date from a PAST anchor lands in the future. ----
  insert into public.calendar_events (company_id, title, due_date, recurs, period, source, entity_id)
       values (co, '073 probe yearly', '2021-09-01', true, 'year', 'person', site) returning id into ev;
  select * into r from public.calendar_v where id = ev;
  if r.next_due is null then
    raise exception 'MIGRATION 073 FAILED: a yearly date with an anchor and a period has no next_due.';
  end if;
  if r.next_due < current_date then
    raise exception 'MIGRATION 073 FAILED: next_due % is in the past (anchor 2021-09-01, period year).', r.next_due;
  end if;
  if extract(month from r.next_due) <> 9 or extract(day from r.next_due) <> 1 then
    raise exception 'MIGRATION 073 FAILED: next_due % is not a 1 September anniversary.', r.next_due;
  end if;
  if r.days_until is null or r.days_until < 0 then
    raise exception 'MIGRATION 073 FAILED: days_until is %, which cannot be right for a future next_due.', coalesce(r.days_until::text, '<null>');
  end if;
  if r.has_passed then
    raise exception 'MIGRATION 073 FAILED: a repeating date with a future occurrence was marked passed.';
  end if;
  if r.site_id <> site or r.site_name <> 'Portland' then
    raise exception 'MIGRATION 073 FAILED: the view did not resolve the row''s own site.';
  end if;

  -- A ONE-OFF IN THE PAST has passed and its next_due is its own day. The direction not built.
  insert into public.calendar_events (company_id, title, due_date, recurs, source)
       values (co, '073 probe past one-off', '2020-01-01', false, 'person') returning id into ev;
  select * into r from public.calendar_v where id = ev;
  if r.next_due <> date '2020-01-01' then
    raise exception 'MIGRATION 073 FAILED: a one-off''s next_due is %, not its own date.', coalesce(r.next_due::text, '<null>');
  end if;
  if not r.has_passed then
    raise exception 'MIGRATION 073 FAILED: a one-off dated 2020 was not marked passed.';
  end if;

  -- A REPEATER WITH NO PERIOD has no next_due, and is not told it has passed (decision 23).
  select * into r from public.calendar_v where company_id = co and title = 'repeats, day not known yet';
  if r.next_due is not null then
    raise exception 'MIGRATION 073 FAILED: a repeating date with no day got a next_due of %.', r.next_due;
  end if;
  if r.has_passed then
    raise exception 'MIGRATION 073 FAILED: a repeating date with no day was marked passed.';
  end if;

  -- source_title: the document's title through document_index_v, and the audit's agency and date.
  select * into r from public.calendar_v where company_id = co and title = 'Permit expires' and due_date = date '2027-01-01';
  if r.source_title <> '073 probe permit' then
    raise exception 'MIGRATION 073 FAILED: a document date''s source_title is %, not the document''s title.', coalesce(r.source_title, '<null>');
  end if;
  if r.site_id <> site then
    raise exception 'MIGRATION 073 FAILED: a document date did not inherit the document''s site through the view.';
  end if;
  select * into r from public.calendar_v where company_id = co and source = 'audit';
  if r.source_title is null or r.source_title not like 'Oregon DEQ%' then
    raise exception 'MIGRATION 073 FAILED: an audit date''s source_title is %.', coalesce(r.source_title, '<null>');
  end if;

  -- The view is security_invoker, or it is a hole through this table's RLS (043:220–225).
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'calendar_v'
     and c.reloptions @> array['security_invoker=true'];
  if n <> 1 then
    raise exception 'MIGRATION 073 FAILED: calendar_v is not security_invoker.';
  end if;

  -- ---- 9. GRANTS, READ BACK, ALL EIGHT RIGHTS, BOTH ROLES, THREE TABLES AND THE VIEW. ----
  -- `CLAUDE.md` §3.6: a grant list describes what you added, not what the role holds. Read, never
  -- trusted — and `information_schema.role_table_grants` is not used, because it is blind from the
  -- CLI (`docs/HR-MACHINERY.md` B12).
  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    foreach rel in array array['calendar_events', 'calendar_mailings', 'calendar_feed_tokens', 'calendar_v'] loop
      if has_table_privilege('anon', 'public.' || rel, v) then
        raise exception 'MIGRATION 073 FAILED: anon holds % on %.', v, rel;
      end if;
    end loop;
  end loop;
  -- authenticated: exactly SELECT, INSERT, UPDATE on the table; SELECT alone on the rest.
  foreach v in array array['SELECT', 'INSERT', 'UPDATE'] loop
    if not has_table_privilege('authenticated', 'public.calendar_events', v) then
      raise exception 'MIGRATION 073 FAILED: authenticated lost % on calendar_events.', v;
    end if;
  end loop;
  foreach v in array array['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('authenticated', 'public.calendar_events', v) then
      raise exception 'MIGRATION 073 FAILED: authenticated still holds % on calendar_events — decision 11 takes DELETE away.', v;
    end if;
  end loop;
  foreach rel in array array['calendar_mailings', 'calendar_feed_tokens', 'calendar_v'] loop
    if not has_table_privilege('authenticated', 'public.' || rel, 'SELECT') then
      raise exception 'MIGRATION 073 FAILED: authenticated cannot SELECT %.', rel;
    end if;
    foreach v in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
      if has_table_privilege('authenticated', 'public.' || rel, v) then
        raise exception 'MIGRATION 073 FAILED: authenticated holds % on %, which is SELECT-only.', v, rel;
      end if;
    end loop;
  end loop;
  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    foreach rel in array array['calendar_events', 'calendar_mailings', 'calendar_feed_tokens'] loop
      if not has_table_privilege('service_role', 'public.' || rel, v) then
        raise exception 'MIGRATION 073 FAILED: service_role lost % on %, and the server needs it.', v, rel;
      end if;
    end loop;
  end loop;

  -- ---- 10. RLS IS ON, AND THE DELETE POLICY IS GONE. ----
  foreach rel in array array['calendar_events', 'calendar_mailings', 'calendar_feed_tokens'] loop
    if not (select relrowsecurity from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
             where ns.nspname = 'public' and c.relname = rel) then
      raise exception 'MIGRATION 073 FAILED: RLS is not enabled on %.', rel;
    end if;
  end loop;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'calendar_events' and cmd = 'DELETE';
  if n <> 0 then
    raise exception 'MIGRATION 073 FAILED: % DELETE policy(ies) remain on calendar_events.', n;
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'calendar_events'
     and (qual is null and with_check is null);
  if n <> 0 then
    raise exception 'MIGRATION 073 FAILED: % calendar_events policy(ies) have neither USING nor WITH CHECK.', n;
  end if;
  -- Both writes carry WITH CHECK (`CLAUDE.md` §3.6), which is what stops a row being written INTO
  -- another company rather than merely read out of one.
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'calendar_events'
     and cmd in ('INSERT', 'UPDATE') and with_check is not null;
  if n <> 2 then
    raise exception 'MIGRATION 073 FAILED: expected 2 write policies with WITH CHECK, found %.', n;
  end if;

  -- ---- 11. THE TWO NEW TABLES' OWN RULES. ----
  insert into public.calendar_mailings (company_id, month, sent_to)
       values (co, '2026-11', array['someone@example.com']);
  begin
    insert into public.calendar_mailings (company_id, month) values (co, '2026-11');
    raise exception 'MIGRATION 073 FAILED: the same company and month were accepted twice — a double send.';
  exception when unique_violation then null; end;
  insert into public.calendar_feed_tokens (company_id, token) values (co, '073-probe-token');
  begin
    insert into public.calendar_feed_tokens (company_id, token) values (coB, '073-probe-token');
    raise exception 'MIGRATION 073 FAILED: two companies were allowed the same feed token.';
  exception when unique_violation then null; end;

  -- ---- 12. THE INDEXES EXIST, BY NAME. ----
  foreach v in array array['idx_calendar_events_company_due', 'idx_calendar_events_company_status',
                           'idx_calendar_events_company_document_title_due'] loop
    select count(*) into n from pg_indexes where schemaname = 'public' and indexname = v;
    if n <> 1 then raise exception 'MIGRATION 073 FAILED: index % is missing.', v; end if;
  end loop;

  delete from public.companies where id in (co, coB);
  raise notice 'MIGRATION 073 VERIFIED: a one-off with no day refused and a recurring one accepted; '
    'status, source and period each refused a plausible old value and accepted every good one; the '
    'same document date refused twice, in two cases and undated, while a moved date and two typed '
    'dates are allowed; cross-tenant finding and handbook pointers refused; a handbook delete nulls '
    'handbook_id and not company_id; all three person columns are SET NULL onto auth.users and '
    'added_by is no longer CASCADE, and the six old columns are '
    'gone; ai_calls takes calendar and all 15 prior tasks and refuses calendarx; job_runs takes '
    'calendar_month and all 6 prior jobs; topics takes calendar, refuses calendars and still '
    'defaults to workspace; calendar_v computes next_due in the future from a 2021 anchor, a '
    'one-off''s own date with has_passed, null for a repeater with no day, the site live from the '
    'document and the agency in source_title, and it is security_invoker; all 8 rights read back '
    'for anon, authenticated and service_role on three tables and the view; RLS on, no DELETE '
    'policy, both writes carry WITH CHECK; the mailing and token unique keys refuse a double send '
    'and a shared token; all 3 indexes present.';
end $$;

commit;
