-- ===========================================================================
-- 073 — A DATE KNOWS WHERE IT CAME FROM, AND LANDS ONCE
--
-- Calendar Step 3, foundations. The plan is `docs/CALENDAR-PLAN.md` (decisions 2–7, 9, 11, 12, 14, 19);
-- the decision record is `DECISIONS.md` §185; the read-only map it rests on is
-- `docs/CALENDAR-MACHINERY.md`, whose numbered findings are cited here as B1 … B18.
--
-- WHY. The calendar today cannot answer three questions a compliance calendar exists to answer.
--
--   1. WHERE DID THIS DATE COME FROM? `calendar_events` carries `document_id` and `handbook_id` and
--      nothing else, and the page does not even read those (B12). A date with no provenance is a date
--      nobody can check, and this product's whole claim is that a date can be traced to the line of
--      the document that set it.
--   2. HAS A PERSON AGREED TO IT? There is no state at all. Decision 3 reverses the old say-so rule for
--      DOCUMENT dates — a reading's dates now land by themselves — and that reversal is only safe if an
--      unconfirmed date is visibly unconfirmed and is kept out of the month and the monthly email
--      (§185, "what makes the reversal safe"). That needs a column.
--   3. IS THIS THE SAME DATE WE ALREADY HAVE? Nothing stops a duplicate. Two readings, Documents and
--      Audits, or two presses all produce a second row (B7, B8). There is no unique key of any kind on
--      this table.
--
-- And three defects of the table itself, each proved in the map:
--   · `user_id` is ON DELETE CASCADE to `auth.users` (`000:364`), so removing a colleague's login
--     deletes the company's calendar rows that person added, although the calendar is a company asset
--     (`app/api/calendar/route.ts:74–88`). B10.
--   · every repeating date is written `recurrence_period = 'annually'` (`app/api/document-actions/route.ts:144`),
--     while the only repeats staging holds are monthly ("Items marked N are reported … by the 5th").
--     B4.
--   · `document_id` and `entity_id` are PLAIN foreign keys (`040:195`, `009:98–99`), so a row may point
--     at another company's document or site and RLS — which checks only the row's own `company_id` —
--     would never notice. This is the hole 055 recorded and 058 and 066 closed everywhere else.
--
-- WHAT IS NOT HERE. No behaviour changes in this migration. Nothing starts writing the new columns:
-- the shared function (`docs/CALENDAR-PLAN.md` decision 8) does that, in the same step, and until then
-- every existing insert keeps working unchanged **except** that it must now supply `date_key` — which
-- is the point of the key, and is why the function is the only writer afterwards.
--
-- TENANCY IS COMPOSITE, as 055, 058 and 066 did it: every pointer between tables, and to a site, is a
-- foreign key on `(company_id, <id>)`. A pointer that must outlive its target uses
-- `ON DELETE SET NULL (<column>)` (Postgres 15+; staging is 17.6, read back below), which clears only
-- that column — a plain SET NULL on a composite key would also null `company_id`, the failure 055
-- recorded.
--
-- *** THREE THINGS IN THIS FILE GO BEYOND `docs/CALENDAR-PLAN.md` §2.6 AND ARE FOR THE OWNER TO
-- *** APPROVE BEFORE IT IS APPLIED. They are marked PROPOSAL 1, 2 and 3 where they appear, and the
-- *** report that ships with this file states each one's cost. Two of them are forced: a composite
-- *** foreign key cannot reference a table that has no unique key on `(company_id, id)`, and `topics`
-- *** (the Workspace's table) and `audit_findings` (Audits' table) have none.
--
-- STATUS AND KIND COLUMNS ARE text WITH A CHECK, as 058 and 066 do.
-- GRANTS: REVOKE ALL from anon and authenticated FIRST, then grant exactly what is stated (§3.6), and
-- read every privilege back with `has_table_privilege` rather than trusting the grant list.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. The ground this migration stands on, checked before anything is changed.
-- ---------------------------------------------------------------------------
-- `ON DELETE SET NULL (<column>)` is Postgres 15+. A migration that assumed it on an older server
-- would fail half way through a chain, so the version is asked rather than assumed.
do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'MIGRATION 073 REFUSED: this file needs Postgres 15 or newer (found %).',
                    current_setting('server_version');
  end if;
end $$;

-- `calendar_events.company_id` is nullable today, and a null one silently switches OFF every composite
-- foreign key below (MATCH SIMPLE: a key with a null part is not checked) and breaks the unique key,
-- which is what makes one date one date. So the column becomes NOT NULL.
--
-- *** PROPOSAL 1 — not in the plan. *** It is safe to the extent that no such row exists: migration
-- 003 read production on 9 September (47 rows, 0 null `company_id`, `003:48–53`) and staging reads
-- 1 of 1 today. It is asked rather than assumed, and the migration REFUSES rather than dropping a row.
do $$
declare n int;
begin
  select count(*) into n from public.calendar_events where company_id is null;
  if n > 0 then
    raise exception 'MIGRATION 073 REFUSED: % calendar event(s) have no company_id. A null company '
      'turns off every composite foreign key below and breaks the one-date-once key. Give them a '
      'company or delete them, deliberately, and run this again.', n;
  end if;
end $$;
alter table public.calendar_events alter column company_id set not null;

-- ---------------------------------------------------------------------------
-- 1. The unique keys the composite foreign keys need.
-- ---------------------------------------------------------------------------
-- *** PROPOSAL 2 — not in the plan, and forced. *** `topics` and `audit_findings` carry no
-- `unique (company_id, id)`, read from `pg_constraint` on staging rather than assumed, so a composite
-- foreign key cannot reference them. `audit_runs`, `audit_sections`, `documents`, `entities` and
-- `handbooks` all already have one. These two additions touch a Workspace table and an Audits table.
--
-- Each is a unique index over a pair that is ALREADY unique (`id` is the primary key), so it refuses
-- nothing that is possible today and no row can fail it. The cost is one index on each table and one
-- more object in the staging/production comparison (`AUDIT-CHECKS.md` check 10).
alter table public.topics drop constraint if exists topics_company_id_id_key;
alter table public.topics add constraint topics_company_id_id_key unique (company_id, id);

alter table public.audit_findings drop constraint if exists audit_findings_company_id_id_key;
alter table public.audit_findings add constraint audit_findings_company_id_id_key unique (company_id, id);

-- `document_deadlines` needs the same, for PROPOSAL 3 below (the event's link back to the deadline row
-- it came from). Same argument: `id` is already the primary key.
alter table public.document_deadlines drop constraint if exists document_deadlines_company_id_id_key;
alter table public.document_deadlines add constraint document_deadlines_company_id_id_key unique (company_id, id);

-- ---------------------------------------------------------------------------
-- 2. calendar_events — where a date came from (decision 2)
-- ---------------------------------------------------------------------------
-- `source` says which section put it there. The default is 'hand' because that is what every row that
-- exists before this migration is (decision 19), and because a writer that does not say is a person
-- typing: the one source that needs no provenance.
alter table public.calendar_events add column if not exists source text;
update public.calendar_events set source = case
  -- Derived from the links rather than set flat to 'hand'. On production the result IS decision 19's
  -- "they become hand-added": the owner's own read-only query on 9 October found none linked, so every
  -- row takes 'hand'. On staging one row carries a `handbook_id` (written by the parked HR route on
  -- 8 October), and calling that one hand-added would put a false record in the one column whose job
  -- is to say where a date came from.
  when handbook_id is not null then 'handbook'
  when document_id is not null then 'document'
  else 'hand' end
 where source is null;
alter table public.calendar_events alter column source set default 'hand';
alter table public.calendar_events alter column source set not null;
alter table public.calendar_events drop constraint if exists calendar_events_source_check;
alter table public.calendar_events add constraint calendar_events_source_check
  check (source in ('document', 'conversation', 'audit', 'hand', 'handbook'));

-- The state (decision 6). Five values, and the screen's words are three of them: Not confirmed, Passed
-- (a past date not done, which is arithmetic and not a state) and Done.
--
-- The default is the CAUTIOUS value, not the convenient one: a writer that forgets to say leaves the
-- date waiting for a person rather than asserting that somebody agreed to it. The old rows are then
-- set to 'confirmed' explicitly below, which is decision 19.
alter table public.calendar_events add column if not exists state text not null default 'not_confirmed';
alter table public.calendar_events drop constraint if exists calendar_events_state_check;
alter table public.calendar_events add constraint calendar_events_state_check
  check (state in ('not_confirmed', 'confirmed', 'done', 'rejected', 'withdrawn'));

-- "Not right" keeps the date and asks for one line of reason (decision 6), so the next reading of that
-- document does not raise it again. A rejected date with no reason is the thing this CHECK refuses: a
-- date nobody can learn from, which is `handbooks_could_not_read_says_why`'s shape (`066:80`).
alter table public.calendar_events add column if not exists rejected_reason text;
alter table public.calendar_events drop constraint if exists calendar_events_rejected_says_why;
alter table public.calendar_events add constraint calendar_events_rejected_says_why
  check (state <> 'rejected' or rejected_reason is not null);

-- How often it repeats (decision 9). THREE VALUES AND NOTHING ELSE, and this is what retires the
-- 'annually' rule: `recurrence_period` was free text offering ten values of which the stored set held
-- none (`006:66–71`), and `document-actions:144` wrote 'annually' for every repeating deadline whatever
-- the document said (B4).
--
-- `recurrence_period` is NOT dropped. It is the old rows' own record, and `category` keeps it company:
-- both stay readable and neither is written again (decision 2). Dropping a column a person's data lives
-- in, to tidy up, is the opposite of this project's rule about history.
alter table public.calendar_events add column if not exists repeats_every text;
alter table public.calendar_events drop constraint if exists calendar_events_repeats_every_check;
alter table public.calendar_events add constraint calendar_events_repeats_every_check
  check (repeats_every is null or repeats_every in ('monthly', 'quarterly', 'yearly'));

-- A repeat with no idea how often is a repeat nobody can roll forward; a "how often" on a date that
-- does not repeat is a contradiction. Both are refused — but only in the direction that is always
-- wrong: `is_recurring` true with `repeats_every` null is ALLOWED, because that is exactly the
-- not-confirmed document date whose screen reads "Repeats — how often?" and waits for a person
-- (decision 9).
alter table public.calendar_events drop constraint if exists calendar_events_how_often_needs_a_repeat;
alter table public.calendar_events add constraint calendar_events_how_often_needs_a_repeat
  check (repeats_every is null or is_recurring is true);

-- ---------------------------------------------------------------------------
-- 2a. A DATE A PERSON MUST ANSWER IS STILL A CALENDAR ROW (decisions 5, 6)
-- ---------------------------------------------------------------------------
-- The To confirm tab has to hold two kinds of date that are NOT ready to be shown as deadlines:
--   · one with NO DAY — a repeat whose day is on an invoice nobody has given us ("Items marked N are
--     reported to the Plant Manager by the 5th", the only repeats staging holds);
--   · one whose SOURCE LINE WAS NOT FOUND in the document (decision 5), which must not reach the month
--     or the monthly email until a person says it is right.
--
-- *** WHY THEY ARE ROWS HERE AND NOT LEFT IN `document_deadlines`. *** Decision 6 requires that "Not
-- right" on any of them is REMEMBERED, so the next reading does not raise it again. A deadline row
-- cannot remember it: `saveScan` writes NEW `document_deadlines` rows on every reading
-- (`lib/documentScan.ts:893–898`) and has no state on them, so a rejection recorded there is gone the
-- next time the document is read — the exact failure decision 6 exists to prevent. A `calendar_events`
-- row survives a re-reading, is matched by `date_key`, and already has `state = 'rejected'` with its
-- reason. One place a person's answer lives, one key to match the next reading against.
--
-- So `due_date` becomes NULLABLE. It was `not null` from the baseline (`000:95`), which is why a
-- dateless repeat had nowhere to go but Audits' own text ("recurs, no date in the reading",
-- `components/AuditReport.tsx:1029–1031`).
alter table public.calendar_events alter column due_date drop not null;

-- A DATELESS DATE MUST REPEAT. A one-off with no day is a row nobody can ever act on and nothing can
-- ever place; Audits already draws this line and migration 060 settled it there
-- (`audit_findings_date_has_a_date`: a `date` needs a `due_on` unless `recurs` is true). The same line,
-- the same reason.
alter table public.calendar_events drop constraint if exists calendar_events_dateless_must_repeat;
alter table public.calendar_events add constraint calendar_events_dateless_must_repeat
  check (due_date is not null or is_recurring is true);

-- Whether the line this date rests on was found in the document, carried over from the deadline row's
-- own answer (section 6). THREE-VALUED, with `document_deadlines.quote_verified`'s meaning exactly:
-- true found, false not found, NULL nothing to check against — a format that yielded no text, or a
-- source that has no line at all (a person typing, a conversation). NULL is not "not found", and the
-- difference is the whole point: we may not tell somebody their line is missing when we never had text
-- to look in (`CLAUDE.md` §5.1).
alter table public.calendar_events add column if not exists line_verified boolean;

-- *** THE GUARDRAIL, AS A COLUMN THE DATABASE COMPUTES. ***
-- Decision 5 is a safety property of the reversal in decision 3: a date with no day, or one whose line
-- we could not find, is NOT on the month and NOT in the monthly email until a person confirms it. A
-- rule like that, written out in each of the month query, the list query, the email query and the
-- dashboard, is a rule that will be right in three places and wrong in the fourth. So it is computed
-- once, here, and every reader filters on it:
--
--     the month, the list, the email, the dashboard   ->  where counts_as_due
--     the To confirm tab                              ->  where state = 'not_confirmed'
--
-- *** A PERSON'S CONFIRMATION OUTRANKS THE LINE CHECK, which is why the third clause is written the
-- *** way it is. Decision 5 says a date whose line was not found stays off the month and the email
-- "until confirmed" — so the line only gates a date NOBODY has answered yet. Once a person has said it
-- is right, it is right: they can see the document and we cannot read it as well as they can. A
-- formula that kept it off for ever would be the product overruling its customer about their own
-- paperwork.
--
-- `done` is in the list because the month still draws a done date, struck through (board 1). The email
-- adds `state <> 'done'` of its own, because "what is due this month" is not "what you have finished".
--
-- `stored`, and every operator in it is immutable, so it is a real column that can be indexed rather
-- than a rule re-typed in four queries.
alter table public.calendar_events drop column if exists counts_as_due;
alter table public.calendar_events add column counts_as_due boolean
  generated always as (
    due_date is not null
    and state in ('not_confirmed', 'confirmed', 'done')
    and (state <> 'not_confirmed' or line_verified is not false)
  ) stored;
create index if not exists idx_calendar_events_company_due_board
  on public.calendar_events (company_id, due_date) where counts_as_due;

-- ---------------------------------------------------------------------------
-- 3. calendar_events — the four links, every one composite (decision 2)
-- ---------------------------------------------------------------------------
alter table public.calendar_events add column if not exists topic_id uuid;
alter table public.calendar_events add column if not exists audit_finding_id uuid;

-- *** PROPOSAL 3 — not in the plan: the event's link back to the `document_deadlines` row. ***
-- The plan asks (decision 4) that when a reading or a version stops being current, its NOT-CONFIRMED
-- dates leave the calendar, marked `withdrawn`. Without this column that sweep has to re-derive which
-- event belongs to which deadline by rebuilding the key — so a re-read that changes the source line at
-- all (a better extraction, a corrected OCR) leaves an event nothing can match, and a stale date stays
-- on the calendar silently. That is the failure the whole decision exists to prevent.
-- With it, the sweep is one join: every event whose `document_deadline_id` is no longer in
-- `document_dates_current_v`. It also makes the Documents report's "On your calendar" a lookup rather
-- than a recomputation.
-- SET NULL, not CASCADE: a deadline row disappears whenever its scan is deleted, and a CONFIRMED date
-- must survive that — a person said it was right.
alter table public.calendar_events add column if not exists document_deadline_id uuid;

alter table public.calendar_events drop constraint if exists calendar_events_topic_in_same_company;
alter table public.calendar_events add constraint calendar_events_topic_in_same_company
  foreign key (company_id, topic_id) references public.topics (company_id, id)
  on delete set null (topic_id);

alter table public.calendar_events drop constraint if exists calendar_events_finding_in_same_company;
alter table public.calendar_events add constraint calendar_events_finding_in_same_company
  foreign key (company_id, audit_finding_id) references public.audit_findings (company_id, id)
  on delete set null (audit_finding_id);

alter table public.calendar_events drop constraint if exists calendar_events_deadline_in_same_company;
alter table public.calendar_events add constraint calendar_events_deadline_in_same_company
  foreign key (company_id, document_deadline_id) references public.document_deadlines (company_id, id)
  on delete set null (document_deadline_id);

-- *** PROPOSAL 1, second half: `entity_id` and `document_id` become composite too. ***
-- The brief asks about `entity_id` (`009:98–99`); `document_id` (`040:195`) is the identical hole and is
-- done in the same breath rather than left as the one plain pointer on the table.
-- What it costs: each is a drop and an add, which takes a brief ACCESS EXCLUSIVE lock on
-- `calendar_events` and validates every row (47 on production, 1 on staging — milliseconds). The
-- behaviour a person sees does not change, because nothing writes a cross-company id today; what
-- changes is that it could not.
alter table public.calendar_events drop constraint if exists calendar_events_entity_id_fkey;
alter table public.calendar_events drop constraint if exists calendar_events_site_in_same_company;
alter table public.calendar_events add constraint calendar_events_site_in_same_company
  foreign key (company_id, entity_id) references public.entities (company_id, id)
  on delete set null (entity_id);

alter table public.calendar_events drop constraint if exists calendar_events_document_id_fkey;
alter table public.calendar_events drop constraint if exists calendar_events_document_in_same_company;
alter table public.calendar_events add constraint calendar_events_document_in_same_company
  foreign key (company_id, document_id) references public.documents (company_id, id)
  on delete set null (document_id);

-- A DATE MAY NOT CLAIM A SOURCE IT CANNOT SHOW — AND THE PROOF IS `date_key`, NOT THE LINK COLUMN.
--
-- *** WHAT THE OWNER ASKED FOR, AND WHY IT CANNOT BE A CHECK ON THE LINK COLUMN. ***
-- The owner's correction of 9 October: the CHECK must REQUIRE the source's own link and must NOT forbid
-- the others, because an audit date carries `audit_finding_id` and the finding's `document_id`, a
-- document date carries `document_id` and `document_deadline_id`, and a handbook date may carry
-- `entity_id`. The second half is honoured below. The first half was written as
-- `check (case source when 'document' then document_id is not null … end)` and **THIS FILE'S OWN VERIFY
-- BLOCK REFUSED IT**, which is the whole reason the block exists. The output, from the first apply
-- attempt on staging (9 October, nothing was applied — `supabase_migrations.schema_migrations` still
-- read 072 afterwards):
--
--     ERROR: new row for relation "calendar_events" violates check constraint
--            "calendar_events_source_has_its_link" (SQLSTATE 23514)
--     Failing row contains (…, From a conversation, …, conversation, confirmed, …, conversation:keep)
--
-- The failing row was not an insert. It was `delete from public.topics`, whose `ON DELETE SET NULL
-- (topic_id)` cleared the column — and **a cascaded SET NULL is a row modification, so every CHECK on
-- the row is re-evaluated.** The constraint therefore made it IMPOSSIBLE TO DELETE a conversation, a
-- document or a handbook that any date came from. Two of the owner's own decisions collided: decision 2
-- says a date outlives its source (SET NULL), and the required link says it may not.
--
-- *** THE RESOLUTION, and it keeps the guarantee the owner wanted. ***
-- `date_key` is `not null`, is set once by the one writer, is never updated, and already begins with the
-- source's name (`document:<uuid>:<day>:<line>`). So the claim "this is a document date" is proved by a
-- column that no deletion can clear:
--
--     check (date_key like source || ':%')
--
-- A row cannot say `source = 'document'` while its key says `conversation:`. And when the document is
-- later deleted, `document_id` goes null, the key still says which document it was, and the drawer can
-- say so in words rather than showing a dead link — which is the honest state, not a broken one.
--
-- *** AND THE WRITE-TIME RULE IS NOT LOST — IT MOVES TO THE ONE WRITER. *** "A document date must be
-- given a document" is an invariant about what a CALLER must supply, and `docs/HOW-WE-BUILD.md` §3 is
-- explicit that some invariants cannot be constraints and need a named owner instead. The owner here is
-- `addDate` in `lib/calendarDates.ts`, which refuses a date whose source link is missing, with a unit
-- test per source. The database keeps the part that is true for ever.
alter table public.calendar_events drop constraint if exists calendar_events_one_source_link;
alter table public.calendar_events drop constraint if exists calendar_events_source_has_its_link;
-- The constraint itself is added in section 4, where `date_key` exists.

-- `user_id` — ON DELETE SET NULL, not CASCADE (decision 12, B10). "Added by" is worth keeping and is
-- not worth a date for: a compliance calendar that forgets a renewal because somebody left the company
-- is the product failing at the one thing it is for.
alter table public.calendar_events drop constraint if exists calendar_events_user_id_fkey;
alter table public.calendar_events add constraint calendar_events_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. ONE DATE, ONCE (decision 7)
-- ---------------------------------------------------------------------------
-- `date_key` is the identity of the thing the date IS, and `unique (company_id, date_key)` is what makes
-- a second write of the same thing impossible rather than merely unlikely. The shared function builds
-- it (`docs/CALENDAR-PLAN.md` decision 8) and unit tests pin its shape; the database's job is only to
-- refuse two rows that claim to be the same date.
--
-- WHY THE KEY IS BUILT IN CODE AND NOT AS A GENERATED COLUMN. A generated column would be stronger — it
-- could not be bypassed — but the normalisation it needs (`due_date` to text, case and punctuation
-- folded) is not IMMUTABLE in Postgres, and `date_key`'s content differs by source. One function with
-- tests, and a unique index that refuses collisions whatever built them, is the trade taken.
--
-- WHAT IT IS, as settled against staging's 36 current dates in step 3a:
--   document      'document:<document_id>:<YYYY-MM-DD|no-day>:<normalised source line>'
--   audit         'audit:<document_id|finding_id>:<day|no-day>:<normalised quote>'
--   conversation  'conversation:<topic_id>:<day|no-day>:<normalised line>'
--   handbook      'handbook:<handbook_id>:<day|no-day>:<normalised quote>'
--   hand          'hand:<this row''s own id>'  — a person's dates are never deduplicated against
--                 each other, because a person pressing Save is the authority on whether it is a
--                 second date.
--
-- The counts behind it (step 3a, printed in the report): over the 36 current dates,
-- (document, day) gives 33 distinct — three collisions, every one of them two genuinely different
-- obligations, and one of them DATED (a fire-extinguisher certificate with both a 6-year internal
-- maintenance and a monthly visual inspection falling on 2026-10-31). Adding the normalised line gives
-- 36 of 36 distinct. And the line is the stable part: re-reading `13-company-self-check.docx` renamed
-- a deadline completely ("Report any items marked N to the Plant Manager" → "Report unchecked items to
-- Plant Manager") while the normalised line was byte-identical. A title is not a key; the line is.
alter table public.calendar_events add column if not exists date_key text;

-- The old rows each get their own identity, which is the honest one: a legacy hand-added date is
-- identified by itself, and no two of them collide. Written before NOT NULL so the column can take it.
-- Prefixed WITH THE ROW'S OWN SOURCE, which section 2 derived from its links, because the CHECK below
-- requires the key to name the source. `:legacy:` says plainly that this key identifies the row by
-- itself rather than by anything read out of a document — which is what a pre-migration row is.
update public.calendar_events
   set date_key = source || ':legacy:' || id::text
 where date_key is null;
alter table public.calendar_events alter column date_key set not null;
alter table public.calendar_events drop constraint if exists calendar_events_date_key_not_blank;
alter table public.calendar_events add constraint calendar_events_date_key_not_blank
  check (length(btrim(date_key)) > 0);

-- *** AND THE KEY MUST NAME THE SOURCE (section 3's note). *** The durable half of the owner's
-- correction: a row cannot claim `source = 'document'` while its key says `conversation:`. It holds
-- after the source row is deleted and its link column is nulled, which is exactly where a CHECK on the
-- link column could not hold.
alter table public.calendar_events drop constraint if exists calendar_events_key_names_its_source;
alter table public.calendar_events add constraint calendar_events_key_names_its_source
  check (date_key like source || ':%');

-- NO DEFAULT, deliberately. From here a writer must say what the date IS before it can be written, and
-- the only writer is the shared function. A default would let a route insert an unidentified date and
-- the duplicate it was meant to prevent.
create unique index if not exists ux_calendar_events_company_date_key
  on public.calendar_events (company_id, date_key);

-- The read the route actually makes (`app/api/calendar/route.ts:84–88` orders a whole company by
-- `due_date`) had no index at all. Company-leading, as §3.7 asks.
create index if not exists idx_calendar_events_company_due on public.calendar_events (company_id, due_date);
-- The month, the list and the email all read by state; the To confirm tab reads one value of it.
create index if not exists idx_calendar_events_company_state on public.calendar_events (company_id, state);
-- Partial, like `idx_calendar_events_company_handbook` (`066:310`): these columns are null on most rows.
create index if not exists idx_calendar_events_company_topic on public.calendar_events (company_id, topic_id)
  where topic_id is not null;
create index if not exists idx_calendar_events_company_finding on public.calendar_events (company_id, audit_finding_id)
  where audit_finding_id is not null;
create index if not exists idx_calendar_events_deadline on public.calendar_events (document_deadline_id)
  where document_deadline_id is not null;

-- ---------------------------------------------------------------------------
-- 5. The old rows (decision 19)
-- ---------------------------------------------------------------------------
-- `source` was set in section 2, where the column was added. What is left is the state and the repeat.
--
-- Confirmed, because a person typed every one of them into the old Add form or picked it out of the old
-- importer's list. Calling them not-confirmed would put 47 dates into a queue on a screen nobody has
-- seen yet, which is a worse first impression of the new tab than the dates themselves.
update public.calendar_events set state = 'confirmed' where state = 'not_confirmed';

-- 'annually' is the only value the old form could store for a yearly repeat, and 'yearly' is what the
-- new column calls it. The other two names are unchanged. Anything else — the ten values the old
-- dropdown offered, none of which the stored rows held (`006:66–71`) — is left NULL on purpose, with
-- `is_recurring` untouched: "it repeats and nobody recorded how often" is exactly the state decision 9
-- gives a person to answer, and inventing a period here would be the 'annually' bug written into a
-- migration.
update public.calendar_events
   set repeats_every = case lower(btrim(recurrence_period))
                         when 'annually'  then 'yearly'
                         when 'annual'    then 'yearly'
                         when 'yearly'    then 'yearly'
                         when 'quarterly' then 'quarterly'
                         when 'monthly'   then 'monthly'
                         else null end
 where is_recurring is true and repeats_every is null;

-- ---------------------------------------------------------------------------
-- 6. document_deadlines — the line is checked now (decision 5)
-- ---------------------------------------------------------------------------
-- A deadline's `source_line` is stored exactly as the model returned it, while a gap's and a fact's
-- quote both go through `verifyQuote` against the document's own extracted text
-- (`lib/documentScan.ts:335`, `:351`, and `:196` for the check itself). So the one thing a date rests on
-- is the one thing nobody checks (B16).
--
-- `saveScan` will run the same check and store the answer here. THREE-VALUED, with the same meaning as
-- `document_gaps.quote_verified` and `audit_findings.quote_verified`: true found, false not found, and
-- NULL "there was nothing to check against" — a format that yielded no text. The difference matters on
-- screen, because false means the calendar must not take the date by itself and null means we cannot
-- say either way.
alter table public.document_deadlines add column if not exists quote_verified boolean;
comment on column public.document_deadlines.quote_verified is
  'Calendar decision 5. Whether `source_line` was found, word for word, in the document''s extracted '
  'text (`lib/documentScan.ts` verifyQuote). NULL means there was no text to check against — not '
  '"not found". A date whose line was not found never reaches the month or the monthly email by '
  'itself; it waits in the To confirm tab.';

-- ---------------------------------------------------------------------------
-- 7. THE CURRENT DATES (decision 4)
-- ---------------------------------------------------------------------------
-- One definition of "the dates this company actually has", in one place, because today there are three
-- and they disagree. A re-read keeps the old reading's rows (`lib/documentScan.ts:744`, `:893–898`);
-- the report reads every reading (`app/api/documents/report/route.ts:43`); and `document_index_v`'s
-- significant date reads every reading too (`049:156–171`), so "Expired" and "Expiring" can come from
-- a reading we have replaced. That is B3, and it is a Documents defect this view fixes.
--
-- CURRENT means two things at once:
--   · the current READING — `document_scans.is_current`, which `saveScan` maintains (`:744`, `:778`);
--   · the current VERSION — no CONFIRMED newer document supersedes this one.
--
-- *** AN UNCONFIRMED PROPOSED VERSION HIDES NOTHING. *** `documents.version_of` is proposed by the scan
-- and confirmed by a person (`040:43–45`), and `version_confirmed` is that person's answer. Letting a
-- guess hide a real expiry is the dangerous direction; showing one date twice for a day is not. So the
-- `not exists` tests `version_confirmed`, and a proposed-but-unanswered version leaves both documents'
-- dates standing.
--
-- `security_invoker = true`, as `document_index_v` (`049:26`) and `topic_list_v` do: the view returns
-- only rows the caller could have selected itself, so RLS is not bypassed by reading through it.
drop view if exists public.document_dates_current_v;
create view public.document_dates_current_v
with (security_invoker = true) as
select
  dd.id                as deadline_id,
  dd.company_id,
  dd.document_id,
  dd.scan_id,
  dd.title,
  dd.due_on,
  dd.source_line,
  dd.quote_verified,
  dd.recurs,
  dd.calendar_event_id,
  dd.created_at,
  s.scanned_at,
  s.entity_id
from public.document_deadlines dd
join public.document_scans s
  on s.id = dd.scan_id
 and s.is_current
where not exists (
  select 1 from public.documents newer
   where newer.version_of = dd.document_id
     and newer.version_confirmed
);

comment on view public.document_dates_current_v is
  'Calendar decision 4 (DECISIONS §185). The dates a company actually has: the CURRENT reading '
  '(document_scans.is_current) of a document that no CONFIRMED newer version supersedes. An '
  'unconfirmed proposed version hides nothing — hiding a real date on a guess is the dangerous '
  'direction. The calendar reads only this; Documents'' report and document_index_v move onto it in '
  'step 4. security_invoker: only rows the caller could select.';

-- The view is a NEW object in `public`, so §3.6's revoke-then-grant applies to it exactly as to a
-- table: this project's default privileges hand both roles everything before a GRANT runs, and not
-- granting is not denying.
revoke all on public.document_dates_current_v from anon;
revoke all on public.document_dates_current_v from authenticated;
grant select on public.document_dates_current_v to authenticated;
grant select on public.document_dates_current_v to service_role;

-- And restated for the two tables this file changed. Redundant where it matches what they already hold
-- (read back in the verify block) and free; §3.6's rule is to write REVOKE-then-GRANT every time rather
-- than reason about what a role happens to hold.
revoke all on table public.calendar_events from anon;
revoke all on table public.calendar_events from authenticated;
grant select, insert, update, delete on table public.calendar_events to authenticated;
grant all on table public.calendar_events to service_role;

revoke all on table public.document_deadlines from anon;
revoke all on table public.document_deadlines from authenticated;
grant select, update on table public.document_deadlines to authenticated;
grant all on table public.document_deadlines to service_role;

-- ---------------------------------------------------------------------------
-- 8. The monthly email's job name (decision 11)
-- ---------------------------------------------------------------------------
-- A CHECK cannot ADD VALUE, so the list is restated in full. The five existing names were read from
-- `pg_constraint` on staging, not copied from `066:326`:
--   summarise, delete, account_delete, scan_documents, audit_sections, handbook_checks
-- `lib/jobAuth.ts:66`'s own union type takes 'calendar_month' in the same step, or `startJobRun` cannot
-- be called with it.
alter table public.job_runs drop constraint if exists job_runs_job_check;
alter table public.job_runs add constraint job_runs_job_check
  check (job = any (array['summarise', 'delete', 'account_delete', 'scan_documents', 'audit_sections',
                          'handbook_checks', 'calendar_month']));

-- ---------------------------------------------------------------------------
-- 9. What the columns mean, on the columns
-- ---------------------------------------------------------------------------
comment on column public.calendar_events.source is
  'Calendar decision 2. Which section put this date here: document | conversation | audit | hand | '
  'handbook. Exactly one source link may be set, and it must be this source''s '
  '(calendar_events_one_source_link).';
comment on column public.calendar_events.state is
  'Calendar decision 6. not_confirmed | confirmed | done | rejected | withdrawn. A document''s dates '
  'arrive not_confirmed (decision 3 reverses the old say-so rule for documents only); audit and '
  'hand-added dates arrive confirmed, because a person pressed. Withdrawn is a date whose reading or '
  'version is no longer current — marked, never deleted.';
comment on column public.calendar_events.repeats_every is
  'Calendar decision 9. monthly | quarterly | yearly, or NULL for "it repeats and nobody has said how '
  'often" — which is what a not-confirmed document date reads, because the scan says only whether a '
  'date repeats. This column retires the rule that wrote "annually" for every repeat.';
comment on column public.calendar_events.rejected_reason is
  'Calendar decision 6. Why a person said this date is not right. Required when state is rejected; it '
  'is what stops the next reading of that document raising the same date again.';
comment on column public.calendar_events.topic_id is
  'Calendar decision 2. The conversation a date came from, when a person added it from a summary. '
  'Composite on (company_id, topic_id); SET NULL on this column only.';
comment on column public.calendar_events.audit_finding_id is
  'Calendar decision 2. The audit finding a date came from. Composite on (company_id, '
  'audit_finding_id); SET NULL on this column only.';
comment on column public.calendar_events.document_deadline_id is
  'Calendar decision 4. The document_deadlines row this date was read from, so a stale reading''s '
  'not-confirmed dates can be withdrawn by a join rather than by rebuilding a key. SET NULL: the '
  'deadline row dies with its scan and a confirmed date must outlive it.';
comment on column public.calendar_events.date_key is
  'Calendar decision 7. What this date IS, built by the one shared add function and unique per company '
  '(ux_calendar_events_company_date_key), so a re-read, a second press, or Audits offering a date '
  'Documents already added cannot make a second row. Hand-added dates key on their own id and are '
  'never deduplicated against each other.';
comment on column public.calendar_events.category is
  'LEGACY, not written since Calendar step 3 (decision 2). The old free-text label: production''s rows '
  'all hold "compliance", which was not one of the ten values the old dropdown offered (006:66-71). '
  'Kept because it is the old rows'' own record; `source` replaces it.';
comment on column public.calendar_events.recurrence_period is
  'LEGACY, not written since Calendar step 3 (decision 9). `repeats_every` replaces it, with a CHECK. '
  'Kept because it is the old rows'' own record of what somebody picked.';

-- ===========================================================================
-- VERIFY — and the standard is §3.7's: a CHECK nobody has tried to break is a comment.
--
-- Every write below that MUST be refused is attempted with a value somebody would plausibly write —
-- 'annually' for a repeat, 'pending' for a state, another company's real id — not obvious junk. Grants
-- are read with `has_table_privilege`, never taken from the grant list above. Two throwaway companies,
-- because the writes that must be refused are the cross-tenant ones.
-- ===========================================================================
do $$
declare
  coA uuid; coB uuid; siteA uuid; siteB uuid; tpA uuid; tpB uuid;
  runA uuid; runB uuid; secA uuid; secB uuid; fndA uuid; fndB uuid;
  docA uuid; docA2 uuid; docB uuid; scanOld uuid; scanNew uuid; dlOld uuid; dlNew uuid;
  evA uuid; n int; p text;
  privs text[] := array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
  ce_stated  text[] := array['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  dd_stated  text[] := array['SELECT', 'UPDATE'];
begin
  -- ---- the view exists and reads ----
  if to_regclass('public.document_dates_current_v') is null then
    raise exception 'MIGRATION 073 FAILED: document_dates_current_v does not exist.';
  end if;

  -- ---- THE OLD ROWS, as section 5 left them — ASSERTED BEFORE A SINGLE PROBE ROW EXISTS, so the
  -- ---- counts below are the real rows and not this block's own.
  select count(*) into n from public.calendar_events where state <> 'confirmed';
  if n > 0 then
    raise exception 'MIGRATION 073 FAILED: % pre-existing calendar row(s) are not confirmed (decision 19).', n;
  end if;
  select count(*) into n from public.calendar_events where source is null;
  if n > 0 then raise exception 'MIGRATION 073 FAILED: % pre-existing row(s) have no source.', n; end if;
  select count(*) into n from public.calendar_events
   where is_recurring and lower(btrim(coalesce(recurrence_period, ''))) in ('annually', 'annual', 'yearly')
     and repeats_every <> 'yearly';
  if n > 0 then
    raise exception 'MIGRATION 073 FAILED: % repeating row(s) said "annually" and did not become yearly.', n;
  end if;
  -- A repeat whose old period this file does not map keeps a null "how often" on purpose: a person is
  -- asked rather than a period invented. Said out loud, with the values, so it is not a silent gap.
  select count(*) into n from public.calendar_events
   where is_recurring and recurrence_period is not null and repeats_every is null;
  if n > 0 then
    raise notice 'MIGRATION 073 NOTE: % repeating row(s) carry a recurrence_period this file does not map, so '
      '"how often" is null and a person will be asked. The values: %', n,
      (select string_agg(distinct recurrence_period, ', ') from public.calendar_events
        where is_recurring and recurrence_period is not null and repeats_every is null);
  end if;

  -- ---- two companies, each with a site, a conversation and an audit finding ----
  insert into public.companies (name) values ('073 probe A') returning id into coA;
  insert into public.companies (name) values ('073 probe B') returning id into coB;
  insert into public.entities (company_id, entity_type, name) values (coA, 'site', 'Plant A') returning id into siteA;
  insert into public.entities (company_id, entity_type, name) values (coB, 'site', 'Plant B') returning id into siteB;
  insert into public.topics (company_id, title) values (coA, 'Sick time') returning id into tpA;
  insert into public.topics (company_id, title) values (coB, 'Sick time') returning id into tpB;

  insert into public.audit_runs (company_id, kind, agency_label) values (coA, 'agency', 'DEQ') returning id into runA;
  insert into public.audit_runs (company_id, kind, agency_label) values (coB, 'agency', 'DEQ') returning id into runB;
  insert into public.audit_sections (run_id, company_id, ordinal, title) values (runA, coA, 0, 'Air') returning id into secA;
  insert into public.audit_sections (run_id, company_id, ordinal, title) values (runB, coB, 0, 'Air') returning id into secB;
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title, due_on)
       values (runA, secA, coA, 0, 'date', 'Annual report due', '2027-03-01') returning id into fndA;
  insert into public.audit_findings (run_id, section_id, company_id, ordinal, kind, title, due_on)
       values (runB, secB, coB, 0, 'date', 'Annual report due', '2027-03-01') returning id into fndB;

  -- ---- a document in A, read TWICE, plus an unconfirmed newer version ----
  insert into public.documents (company_id, name, file_url, file_type)
       values (coA, 'permit.pdf', coA || '/permit.pdf', 'application/pdf') returning id into docA;
  insert into public.documents (company_id, name, file_url, file_type)
       values (coB, 'permit.pdf', coB || '/permit.pdf', 'application/pdf') returning id into docB;
  insert into public.document_scans (document_id, company_id, kind, status, is_current)
       values (docA, coA, 'permit', 'current', false) returning id into scanOld;
  insert into public.document_scans (document_id, company_id, kind, status, is_current)
       values (docA, coA, 'permit', 'current', true) returning id into scanNew;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs)
       values (scanOld, docA, coA, 'Permit expires', '2027-01-01', 'This permit expires 1 January 2027.', false)
       returning id into dlOld;
  insert into public.document_deadlines (scan_id, document_id, company_id, title, due_on, source_line, recurs)
       values (scanNew, docA, coA, 'Expiry of permit', '2027-01-01', 'This permit expires 1 January 2027.', false)
       returning id into dlNew;

  -- THE VIEW SEES THE NEW READING AND NOT THE OLD ONE. This is the whole point of decision 4, so it is
  -- asserted in both directions rather than only the one that passes.
  select count(*) into n from public.document_dates_current_v where document_id = docA;
  if n <> 1 then
    raise exception 'MIGRATION 073 FAILED: the current-dates view returned % rows for a document read twice; expected 1.', n;
  end if;
  if (select deadline_id from public.document_dates_current_v where document_id = docA) <> dlNew then
    raise exception 'MIGRATION 073 FAILED: the current-dates view returned the OLD reading''s deadline.';
  end if;

  -- AN UNCONFIRMED NEWER VERSION HIDES NOTHING; A CONFIRMED ONE DOES.
  insert into public.documents (company_id, name, file_url, file_type, version_of, version_confirmed)
       values (coA, 'permit-2027.pdf', coA || '/permit-2027.pdf', 'application/pdf', docA, false) returning id into docA2;
  select count(*) into n from public.document_dates_current_v where document_id = docA;
  if n <> 1 then
    raise exception 'MIGRATION 073 FAILED: an UNCONFIRMED newer version hid the older document''s dates (% rows).', n;
  end if;
  update public.documents set version_confirmed = true where id = docA2;
  select count(*) into n from public.document_dates_current_v where document_id = docA;
  if n <> 0 then
    raise exception 'MIGRATION 073 FAILED: a CONFIRMED newer version did not supersede the older document''s dates (% rows).', n;
  end if;
  update public.documents set version_confirmed = false where id = docA2;

  -- ---- a well-formed date, with every link a document date may carry ----
  insert into public.calendar_events
       (company_id, title, due_date, source, state, document_id, document_deadline_id, entity_id,
        is_recurring, date_key)
       values (coA, 'Permit expires', '2027-01-01', 'document', 'not_confirmed', docA, dlNew, siteA,
               false, 'document:' || docA::text || ':2027-01-01:thispermitexpires1january2027')
       returning id into evA;

  -- ---- THE KEY REFUSES THE SECOND WRITE OF THE SAME DATE (B7, B8) ----
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, document_id, date_key)
         values (coA, 'Expiry of permit', '2027-01-01', 'document', 'not_confirmed', docA,
                 'document:' || docA::text || ':2027-01-01:thispermitexpires1january2027');
    raise exception 'MIGRATION 073 FAILED: the same date was written twice.';
  exception when unique_violation then null; end;
  -- ...and allows the same key in ANOTHER company, which is a different company's own date.
  insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
       values (coB, 'Permit expires', '2027-01-01', 'document', 'confirmed',
               'document:' || docA::text || ':2027-01-01:thispermitexpires1january2027');

  -- ---- A DATE MAY NOT POINT AT ANOTHER COMPANY'S TOPIC, FINDING, SITE, DOCUMENT OR DEADLINE ----
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, topic_id, date_key)
         values (coA, 'From a conversation', '2027-02-01', 'conversation', 'confirmed', tpB, 'conversation:x:1');
    raise exception 'MIGRATION 073 FAILED: a date pointed at another company''s conversation.';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, audit_finding_id, date_key)
         values (coA, 'From an audit', '2027-02-01', 'audit', 'confirmed', fndB, 'audit:x:1');
    raise exception 'MIGRATION 073 FAILED: a date pointed at another company''s audit finding.';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, entity_id, date_key)
         values (coA, 'At a plant', '2027-02-01', 'hand', 'confirmed', siteB, 'hand:x:1');
    raise exception 'MIGRATION 073 FAILED: a date pointed at another company''s site.';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, document_id,
                                       document_deadline_id, date_key)
         values (coB, 'From a document', '2027-02-01', 'document', 'confirmed', docB, dlNew, 'document:x:1');
    raise exception 'MIGRATION 073 FAILED: a date pointed at another company''s deadline row.';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, document_id, date_key)
         values (coA, 'From a document', '2027-02-01', 'document', 'confirmed', docB, 'document:x:2');
    raise exception 'MIGRATION 073 FAILED: a date pointed at another company''s document.';
  exception when foreign_key_violation then null; end;

  -- ---- THE CHECKS, each with a value somebody would plausibly write ----
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
         values (coA, 'x', '2027-02-01', 'scan', 'confirmed', 'hand:s1');
    raise exception 'MIGRATION 073 FAILED: source accepted "scan".';
  exception when check_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
         values (coA, 'x', '2027-02-01', 'hand', 'pending', 'hand:s2');
    raise exception 'MIGRATION 073 FAILED: state accepted "pending".';
  exception when check_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, is_recurring, repeats_every, date_key)
         values (coA, 'x', '2027-02-01', 'hand', 'confirmed', true, 'annually', 'hand:s3');
    raise exception 'MIGRATION 073 FAILED: repeats_every accepted "annually" — the value this column exists to retire.';
  exception when check_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, is_recurring, repeats_every, date_key)
         values (coA, 'x', '2027-02-01', 'hand', 'confirmed', false, 'yearly', 'hand:s4');
    raise exception 'MIGRATION 073 FAILED: a date that does not repeat was given a repeat period.';
  exception when check_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
         values (coA, 'x', '2027-02-01', 'hand', 'rejected', 'hand:s5');
    raise exception 'MIGRATION 073 FAILED: a rejected date was accepted with no reason.';
  exception when check_violation then null; end;
  -- *** A DATE MAY NOT CLAIM A SOURCE ITS KEY DOES NOT NAME (section 3's note). *** Three plausible
  -- mislabellings, one per source. The matching rule ("a document date must be GIVEN a document") is
  -- `addDate`'s, with its own unit test, because a CHECK on the link column cannot survive the
  -- ON DELETE SET NULL this file requires — proved by this block's own refusal on the first apply.
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, document_id, date_key)
         values (coA, 'x', '2027-02-01', 'document', 'confirmed', docA, 'hand:s6');
    raise exception 'MIGRATION 073 FAILED: a document date was accepted with a hand key.';
  exception when check_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, audit_finding_id, date_key)
         values (coA, 'x', '2027-02-01', 'audit', 'confirmed', fndA, 'conversation:s7');
    raise exception 'MIGRATION 073 FAILED: an audit date was accepted with a conversation key.';
  exception when check_violation then null; end;
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
         values (coA, 'x', '2027-02-01', 'hand', 'confirmed', 'document:s8');
    raise exception 'MIGRATION 073 FAILED: a hand date was accepted with a document key.';
  exception when check_violation then null; end;
  -- ...AND THE LINKS A SOURCE MAY ALSO CARRY ARE NOT FORBIDDEN (the owner's correction, second half).
  -- An audit date carries the finding AND the finding's document; a hand date may carry a site.
  insert into public.calendar_events (company_id, title, due_date, source, state, audit_finding_id,
                                      document_id, date_key)
       values (coA, 'Annual report due', '2027-03-01', 'audit', 'confirmed', fndA, docA, 'audit:ok-both');
  insert into public.calendar_events (company_id, title, due_date, source, state, entity_id, is_recurring, date_key)
       values (coA, 'Policy review', '2027-05-01', 'hand', 'confirmed', siteA, false, 'hand:ok-site');
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
         values (coA, 'x', '2027-02-01', 'hand', 'confirmed', '   ');
    raise exception 'MIGRATION 073 FAILED: a blank date_key was accepted.';
  exception when check_violation then null; end;
  -- A repeat with no "how often" is ALLOWED: it is the not-confirmed document date waiting for a person.
  insert into public.calendar_events (company_id, title, due_date, source, state, is_recurring, date_key)
       values (coA, 'Monthly inspection', '2027-02-05', 'hand', 'not_confirmed', true, 'hand:ok-repeat');

  -- =========================================================================
  -- WHAT THE "TO CONFIRM" TAB MUST BE ABLE TO HOLD (decisions 5, 6; section 2a)
  -- Each case is asserted on the GENERATED column, not on a query somebody wrote by hand, because the
  -- column is the thing every reader will trust.
  -- =========================================================================
  -- 1. A DATELESS REPEAT IS A ROW. It waits in To confirm and is NOT on the month or in the email.
  insert into public.calendar_events (company_id, title, due_date, source, state, is_recurring, document_id, date_key)
       values (coA, 'Report items marked N by the 5th', null, 'document', 'not_confirmed', true, docA,
               'document:' || docA::text || ':no-day:itemsmarkednarereported');
  if (select counts_as_due from public.calendar_events
       where date_key = 'document:' || docA::text || ':no-day:itemsmarkednarereported') is not false then
    raise exception 'MIGRATION 073 FAILED: a date with no day counts as due.';
  end if;
  -- ...and it IS what the To confirm tab reads.
  if (select count(*) from public.calendar_events where company_id = coA and state = 'not_confirmed'
        and due_date is null) <> 1 then
    raise exception 'MIGRATION 073 FAILED: the dateless date is not in the not_confirmed set.';
  end if;

  -- 2. A DATELESS ONE-OFF IS REFUSED. Nobody could ever place it or act on it.
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, is_recurring, document_id, date_key)
         values (coA, 'Something, sometime', null, 'document', 'not_confirmed', false, docA, 'document:dateless');
    raise exception 'MIGRATION 073 FAILED: a one-off date with no day was accepted.';
  exception when check_violation then null; end;

  -- 3. A DATE WHOSE LINE WAS NOT FOUND IS A ROW, AND IS KEPT OFF THE MONTH AND THE EMAIL.
  insert into public.calendar_events (company_id, title, due_date, source, state, line_verified, document_id, date_key)
       values (coA, 'Fee due 1 July', '2027-07-01', 'document', 'not_confirmed', false, docA, 'document:unfound');
  if (select counts_as_due from public.calendar_events where date_key = 'document:unfound') is not false then
    raise exception 'MIGRATION 073 FAILED: a date whose line was not found counts as due.';
  end if;

  -- 4. ...AND A PERSON'S CONFIRMATION OUTRANKS THAT. Decision 5's "until confirmed".
  update public.calendar_events set state = 'confirmed' where date_key = 'document:unfound';
  if (select counts_as_due from public.calendar_events where date_key = 'document:unfound') is not true then
    raise exception 'MIGRATION 073 FAILED: confirming a date whose line was not found did not put it on the month.';
  end if;

  -- 5. A LINE WE NEVER HAD TEXT TO CHECK (null) IS NOT TREATED AS "NOT FOUND" (§5.1).
  insert into public.calendar_events (company_id, title, due_date, source, state, line_verified, document_id, date_key)
       values (coA, 'Renewal 1 August', '2027-08-01', 'document', 'not_confirmed', null, docA, 'document:nulline');
  if (select counts_as_due from public.calendar_events where date_key = 'document:nulline') is not true then
    raise exception 'MIGRATION 073 FAILED: a null line_verified was treated as "not found".';
  end if;

  -- 6. "NOT RIGHT" IS REMEMBERED, AND THE REJECTED DATE LEAVES THE MONTH.
  --    This is the reason these rows live here and not in `document_deadlines`, which saveScan
  --    rewrites on every reading: the rejection has to outlive the next read.
  update public.calendar_events set state = 'rejected', rejected_reason = 'That is the old permit''s fee.'
   where date_key = 'document:nulline';
  if (select counts_as_due from public.calendar_events where date_key = 'document:nulline') is not false then
    raise exception 'MIGRATION 073 FAILED: a rejected date still counts as due.';
  end if;
  if (select rejected_reason from public.calendar_events where date_key = 'document:nulline') is null then
    raise exception 'MIGRATION 073 FAILED: the rejection lost its reason.';
  end if;
  -- The next reading offers the same date again: the KEY is what tells the add function it was refused,
  -- and the unique index is what makes that unmissable.
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, document_id, date_key)
         values (coA, 'Renewal 1 August', '2027-08-01', 'document', 'not_confirmed', docA, 'document:nulline');
    raise exception 'MIGRATION 073 FAILED: a date a person rejected was written again by a later reading.';
  exception when unique_violation then null; end;

  -- 7. A WITHDRAWN DATE IS OFF THE MONTH TOO, and is still there to read (decision 4).
  update public.calendar_events set state = 'withdrawn' where date_key = 'document:unfound';
  if (select counts_as_due from public.calendar_events where date_key = 'document:unfound') is not false then
    raise exception 'MIGRATION 073 FAILED: a withdrawn date still counts as due.';
  end if;
  if (select count(*) from public.calendar_events where date_key = 'document:unfound') <> 1 then
    raise exception 'MIGRATION 073 FAILED: withdrawing a date deleted it.';
  end if;

  -- ---- ANON MAY WRITE NOTHING, and the check proves it can see the table it is refused on ----
  -- `execute` rather than a bare SET: the role is changed through a statement PL/pgSQL hands straight
  -- to the server, which is the form that is certain to apply here. It is LOCAL, so the transaction's
  -- end restores it however this block leaves.
  execute 'set local role anon';
  begin
    insert into public.calendar_events (company_id, title, due_date, source, state, date_key)
         values (coA, 'anon', '2027-02-01', 'hand', 'confirmed', 'hand:anon');
    execute 'reset role';
    raise exception 'MIGRATION 073 FAILED: anon inserted a calendar event.';
  exception when insufficient_privilege then null; end;
  begin
    update public.calendar_events set title = 'anon' where id = evA;
    execute 'reset role';
    raise exception 'MIGRATION 073 FAILED: anon updated a calendar event.';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.calendar_events where id = evA;
    execute 'reset role';
    raise exception 'MIGRATION 073 FAILED: anon deleted a calendar event.';
  exception when insufficient_privilege then null; end;
  begin
    update public.document_deadlines set title = 'anon' where id = dlNew;
    execute 'reset role';
    raise exception 'MIGRATION 073 FAILED: anon updated a document deadline.';
  exception when insufficient_privilege then null; end;
  execute 'reset role';

  -- ---- THE DELETES: what a date outlives ----
  -- Its conversation, its finding, its site and its deadline row may all go; the date stays, with only
  -- that one column cleared, and its company intact (the failure 055 recorded).
  insert into public.calendar_events (company_id, title, due_date, source, state, topic_id, date_key)
       values (coA, 'From a conversation', '2027-04-01', 'conversation', 'confirmed', tpA, 'conversation:keep');
  delete from public.topics where id = tpA;
  if (select count(*) from public.calendar_events where date_key = 'conversation:keep' and company_id = coA
        and topic_id is null) <> 1 then
    raise exception 'MIGRATION 073 FAILED: deleting a conversation did not leave its date with company intact and topic_id cleared.';
  end if;

  delete from public.document_deadlines where id = dlNew;
  if (select count(*) from public.calendar_events where id = evA and company_id = coA
        and document_deadline_id is null and document_id = docA) <> 1 then
    raise exception 'MIGRATION 073 FAILED: deleting a deadline row did not leave its date, unlinked, with its document and company.';
  end if;

  delete from public.entities where id = siteA;
  if (select entity_id from public.calendar_events where id = evA) is not null
     or (select company_id from public.calendar_events where id = evA) <> coA then
    raise exception 'MIGRATION 073 FAILED: deleting a site did not leave its date with company intact and entity_id cleared.';
  end if;

  -- ---- GRANTS, READ BACK, all eight privileges, never taken from the list above ----
  foreach p in array privs loop
    if has_table_privilege('anon', 'public.calendar_events', p) then
      raise exception 'MIGRATION 073 FAILED: anon holds % on calendar_events.', p;
    end if;
    if has_table_privilege('anon', 'public.document_deadlines', p) then
      raise exception 'MIGRATION 073 FAILED: anon holds % on document_deadlines.', p;
    end if;
    if has_table_privilege('anon', 'public.document_dates_current_v', p) then
      raise exception 'MIGRATION 073 FAILED: anon holds % on document_dates_current_v.', p;
    end if;
    if has_table_privilege('authenticated', 'public.calendar_events', p) <> (p = any (ce_stated)) then
      raise exception 'MIGRATION 073 FAILED: authenticated and % on calendar_events is not what was stated.', p;
    end if;
    if has_table_privilege('authenticated', 'public.document_deadlines', p) <> (p = any (dd_stated)) then
      raise exception 'MIGRATION 073 FAILED: authenticated and % on document_deadlines is not what was stated.', p;
    end if;
    if has_table_privilege('authenticated', 'public.document_dates_current_v', p) <> (p = 'SELECT') then
      raise exception 'MIGRATION 073 FAILED: authenticated and % on document_dates_current_v is not what was stated.', p;
    end if;
  end loop;

  -- ---- the four policies on calendar_events are untouched ----
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'calendar_events';
  if n <> 4 then raise exception 'MIGRATION 073 FAILED: expected 4 policies on calendar_events, found %.', n; end if;

  -- ---- the SET NULL constraints are SET NULL, read from the catalog and not from the text above ----
  select count(*) into n from pg_constraint
   where conrelid = 'public.calendar_events'::regclass and confdeltype = 'n'
     and conname in ('calendar_events_topic_in_same_company', 'calendar_events_finding_in_same_company',
                     'calendar_events_deadline_in_same_company', 'calendar_events_site_in_same_company',
                     'calendar_events_document_in_same_company', 'calendar_events_handbook_in_same_company',
                     'calendar_events_user_id_fkey');
  if n <> 7 then
    raise exception 'MIGRATION 073 FAILED: expected 7 ON DELETE SET NULL links on calendar_events, found %.', n;
  end if;

  -- ---- the job name ----
  begin
    insert into public.job_runs (job) values ('calendar_month');
    delete from public.job_runs where job = 'calendar_month';
  exception when check_violation then
    raise exception 'MIGRATION 073 FAILED: job_runs.job refused "calendar_month".';
  end;
  begin
    insert into public.job_runs (job) values ('handbook_checks');
    delete from public.job_runs where job = 'handbook_checks';
  exception when check_violation then
    raise exception 'MIGRATION 073 FAILED: job_runs.job lost an older name while taking the new one.';
  end;

  -- ---- clean up ----
  delete from public.calendar_events where company_id in (coA, coB);
  delete from public.companies where id in (coA, coB);

  raise notice 'MIGRATION 073 VERIFIED: calendar_events carries source, state, how often, a reason, four '
    'composite links and a per-company date key; the key refused a second write of the same date and '
    'allowed another company''s; every cross-tenant pointer was refused; source, state, "annually", a '
    'repeat-less period, a reasonless rejection, a key naming the wrong source and a blank key were all refused; '
    'anon could write nothing on either table or the view; a date outlived its conversation, its '
    'deadline row and its site with its company intact; the current-dates view returned the new '
    'reading only, ignored an unconfirmed newer version and honoured a confirmed one; grants read back '
    'with has_table_privilege on all eight privileges; the job CHECK took calendar_month and kept every '
    'older name. AND the To confirm tab''s three cases: a dateless repeat is a row and is not due, a '
    'dateless one-off is refused, an unfound line is not due until a person confirms it, a null line is '
    'not treated as not-found, a rejection keeps its reason and refuses the next reading''s copy, and a '
    'withdrawn date leaves the month without leaving the table.';
end $$;

commit;
