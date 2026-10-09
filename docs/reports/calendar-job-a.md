# Calendar Job A — everything underneath the page: running report

Started 9 October 2026. Staging only; no production query; nothing pushed. The plan is
`docs/CALENDAR-PLAN.md` (the chat's file, not edited here); the decisions are `DECISIONS.md` §185; the
map's findings are cited as B1 … B18 from `docs/CALENDAR-MACHINERY.md`.

**`npm run cost` at the start:** 298 calls, **$18.46** (staging ledger, 2026-10-04 → 2026-10-08).
Budget for this job: $3.

| Checkpoint | Commit | `npm run check` | Cost after |
|---|---|---|---|
| A1 — 073 on staging | `d0b111f` | 960/960, floor 559 | $18.46 (no model call) |

---

## A7 part 2 — row counts per section, BEFORE A1

`node --env-file=.env.local scripts/calendar-rowcounts.mjs`. Every table counted twice: as the
signed-in caller (RLS applies) and as the service role (RLS does not), because a read that is too
narrow returns fewer rows with a 200 (`HOW-WE-BUILD.md` §3).

```
  AS THE SIGNED-IN CALLER (RLS applies)
  table                      testalpha     testgamma   testcascade
  ----------------------------------------------------------------
  topics (workspace)                 0            23             0
  topics (hr)                       19            39             0
  turns                             43           161             0
  documents                          0             0            12
  document_scans                     0             0            13
  document_deadlines                 0             0            38
  document_index_v                   0             0            12
  fact_proposals                     1            26            50
  company_facts                      0             0             1
  audit_runs                         0             0             0
  audit_sections                     0             0             0
  audit_findings                     0             0             0
  handbooks                          3            10             1
  handbook_checks                    4            27             0
  calendar_events                    0             1             0

  AS THE SERVICE ROLE (RLS does not)   — identical, cell for cell
  CALLER vs SERVICE ROLE: identical on every table for every person.
```

`document_scans` 13 against `document_index_v` 12 is the re-read document the map found (C3): two
scans, one current, one row in the index.

---

## A1 — migration 073 on staging

### The design question the brief asked me to settle first

**Where does a date with NO DAY, or one whose SOURCE LINE WAS NOT FOUND, live?** Decision 5 puts both
in the To confirm tab and keeps them off the month and the email; decision 6 requires that a person's
**"Not right" is remembered, so the next reading does not raise it again.**

**Chosen: `calendar_events.due_date` becomes nullable, and both kinds are calendar rows**, with one
generated column deciding what is a real deadline.

**Why, and the alternative that fails.** The alternative is to leave them in `document_deadlines` and
have To confirm read a union of the two tables. It fails on decision 6: `saveScan` writes **new**
`document_deadlines` rows on every reading (`lib/documentScan.ts:893–898`) and the table has no state,
so a rejection recorded there is gone the next time the document is read — exactly the failure decision
6 exists to prevent. A `calendar_events` row survives a re-reading, is matched by `date_key`, and
already has `state = 'rejected'` with its reason. One place a person's answer lives; one key to match
the next reading against.

**The guardrail is a generated column, not a rule in four queries.**

```sql
counts_as_due boolean generated always as (
  due_date is not null
  and state in ('not_confirmed', 'confirmed', 'done')
  and (state <> 'not_confirmed' or line_verified is not false)
) stored
```

- The month, the list, the email and the dashboard read `where counts_as_due`.
- The To confirm tab reads `where state = 'not_confirmed'`.
- **A person's confirmation outranks the line check**, which is decision 5's own "until confirmed": the
  line gates only a date nobody has answered yet. A formula that kept it off for ever would be the
  product overruling its customer about their own paperwork.
- `line_verified` is three-valued like its siblings: true found, false not found, **null = there was no
  text to check against**, which is not "not found" (`CLAUDE.md` §5.1).
- A **dateless one-off is refused** (`calendar_events_dateless_must_repeat`), the line Audits already
  draws and migration 060 settled there.

### The owner's correction, and what this file's own verify block found

The owner's instruction was: the source-link CHECK must **require** the source's own link and must
**not forbid** others. Both halves were written. The first apply **refused it**, and the refusal is the
reason the verify block exists:

```
ERROR: new row for relation "calendar_events" violates check constraint
       "calendar_events_source_has_its_link" (SQLSTATE 23514)
Failing row contains (…, From a conversation, …, conversation, confirmed, …, conversation:keep)
```

The failing statement was not an insert. It was `delete from public.topics`, whose
`ON DELETE SET NULL (topic_id)` cleared the column — and **a cascaded SET NULL is a row modification,
so every CHECK on the row is re-evaluated.** The constraint therefore made it **impossible to delete a
conversation, a document or a handbook that any date had come from**. Two of the owner's own decisions
collided: decision 2 says a date outlives its source (SET NULL), and a required link says it may not.

**Nothing was applied by that attempt** — `supabase_migrations.schema_migrations` still read `072`
afterwards, and `calendar_events` had 0 of the 4 new columns. Read back, not assumed.

**The resolution, which keeps the guarantee.** `date_key` is `not null`, is written once, is never
updated, and already begins with the source's name. So:

```sql
check (date_key like source || ':%')     -- calendar_events_key_names_its_source
```

A row cannot claim `source = 'document'` while its key says `conversation:`, and the claim survives the
deletion that nulls the link column. **The write-time half is not lost** — "a document date must be
given a document" is an invariant about what a caller supplies, and `HOW-WE-BUILD.md` §3 says plainly
that some invariants cannot be constraints and need a named owner instead. The owner is `addDate`, with
a unit test per source (A2).

**This is reported rather than decided quietly**, because it changes the shape the owner asked for. The
second half of his correction — other links are not forbidden — is honoured exactly, and the verify
block writes an audit date carrying `audit_finding_id` **and** `document_id`, and a hand date carrying
`entity_id`, and requires both to be accepted.

### Applied, and read back from the database

```
$ CHECK_LIVE_BASE_URL=http://localhost:3999 npm run db:migrate
Target project: amzsavsrabrlcprltpom   (staging)
Migrations pending: 1 — 073_a_date_knows_where_it_came_from.sql
Applying migration 073_a_date_knows_where_it_came_from.sql...
{"upToDate":false,"dryRun":false,"migrations":["073_a_date_knows_where_it_came_from.sql"],…}
Types written to lib/database.types.ts (source: staging)
docs/SCHEMA.md written — 51 tables, 30 enums, 8 functions, 5 views, 18 triggers, 74 migrations.
```

```sql
select version from supabase_migrations.schema_migrations order by version desc limit 3
→ 073 | 072 | 071
```

```sql
select column_name, data_type, is_nullable, is_generated from information_schema.columns
 where table_schema='public' and table_name='calendar_events' and column_name in (…)
→ audit_finding_id      uuid    YES  NEVER
  company_id            uuid    NO   NEVER
  counts_as_due         boolean YES  ALWAYS
  date_key              text    NO   NEVER
  document_deadline_id  uuid    YES  NEVER
  due_date              date    YES  NEVER
  line_verified         boolean YES  NEVER
  rejected_reason       text    YES  NEVER
  repeats_every         text    YES  NEVER
  source                text    NO   NEVER
  state                 text    NO   NEVER
  topic_id              uuid    YES  NEVER
```

**The foreign keys, read from the catalog:**

```
calendar_events_company_id_fkey          c  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
calendar_events_deadline_in_same_company n  (company_id, document_deadline_id) → document_deadlines ON DELETE SET NULL (document_deadline_id)
calendar_events_document_in_same_company n  (company_id, document_id) → documents ON DELETE SET NULL (document_id)
calendar_events_finding_in_same_company  n  (company_id, audit_finding_id) → audit_findings ON DELETE SET NULL (audit_finding_id)
calendar_events_handbook_in_same_company n  (company_id, handbook_id) → handbooks ON DELETE SET NULL (handbook_id)
calendar_events_site_in_same_company     n  (company_id, entity_id) → entities ON DELETE SET NULL (entity_id)
calendar_events_topic_in_same_company    n  (company_id, topic_id) → topics ON DELETE SET NULL (topic_id)
calendar_events_user_id_fkey             n  (user_id) → auth.users ON DELETE SET NULL
```

**The CHECKs, as `docs/SCHEMA.md` now records them:**

```
calendar_events_date_key_not_blank        CHECK ((length(btrim(date_key)) > 0))
calendar_events_dateless_must_repeat      CHECK (((due_date IS NOT NULL) OR (is_recurring IS TRUE)))
calendar_events_how_often_needs_a_repeat  CHECK (((repeats_every IS NULL) OR (is_recurring IS TRUE)))
calendar_events_key_names_its_source      CHECK ((date_key ~~ (source || ':%'::text)))
calendar_events_rejected_says_why         CHECK (((state <> 'rejected') OR (rejected_reason IS NOT NULL)))
calendar_events_repeats_every_check       CHECK (((repeats_every IS NULL) OR (repeats_every = ANY (ARRAY['monthly','quarterly','yearly']))))
calendar_events_source_check              CHECK ((source = ANY (ARRAY['document','conversation','audit','hand','handbook'])))
```

**The old row, after the backfill** — the owner's instruction was that the staging row with a
`handbook_id` becomes `handbook`, and that `category` and `recurrence_period` stay:

```sql
select title, source, state, due_date, is_recurring, recurrence_period, repeats_every,
       line_verified, counts_as_due, date_key, (handbook_id is not null) as has_hb
  from public.calendar_events
→ Open enrolment window for health benefits | handbook | confirmed | 2026-11-01 | true |
  annually | yearly | NULL | true | handbook:legacy:8ed83cfd-… | true
```

`annually` → `yearly`; `recurrence_period` kept; `counts_as_due` true. Probe companies left behind:
**0**.

### What the verify block proved

`supabase db push` does not surface `raise notice`, so the evidence that the block passed is that **the
apply succeeded** — the first attempt shows what a failure looks like, and every assertion is a
`raise exception`. What it asserted, in the order it runs:

- The view exists; the pre-existing rows are all confirmed, all have a source, and `annually` became
  `yearly` — **asserted before a single probe row exists**, so the counts are the real rows.
- Two companies, each with a site, a conversation, an audit run, section and date finding, and a
  document; one document **read twice** plus an unconfirmed newer version.
- **The current-dates view returns the new reading and not the old one** — both directions, by
  `deadline_id`. An **unconfirmed** newer version hides nothing; a **confirmed** one supersedes.
- The key **refused** the second write of the same date and **allowed** the same key in another company.
- A date pointing at another company's conversation, finding, site, document and deadline row: all five
  refused with `foreign_key_violation`.
- `source = 'scan'`, `state = 'pending'`, `repeats_every = 'annually'`, a period on a non-repeating
  date, a reasonless rejection, a key naming the wrong source (three ways) and a blank key: all
  refused. An audit date carrying finding **and** document, and a hand date carrying a site: both
  accepted.
- The To confirm cases: a dateless repeat is a row and is **not** due; a dateless one-off is refused; an
  unfound line is not due **until a person confirms it**; a null `line_verified` is **not** treated as
  not-found; a rejection keeps its reason and the next reading's copy of it is refused; a withdrawn
  date leaves the month **without leaving the table**.
- `anon` could not insert, update or delete a calendar event, nor update a deadline.
- A date outlived its conversation, its deadline row and its site, each time with `company_id` intact
  and only the one column cleared.
- Grants read back with `has_table_privilege` across all eight privileges, for both roles, on both
  tables and the view. Four policies still on `calendar_events`. Seven SET NULL links counted from
  `pg_constraint`. `job_runs` took `calendar_month` and kept `handbook_checks`.

### One pre-existing reporting inaccuracy, not introduced here

`docs/SCHEMA.md` prints `calendar_events.company_id — ON DELETE SET NULL`. The real constraint is
`ON DELETE CASCADE`, read from `pg_constraint` above. `scripts/schema-doc.js` lists every *referencing*
column of a SET NULL foreign key, and `company_id` is the first column of all six composite keys.
**The same line has been in the file for `handbooks` since migration 066** (`git show HEAD:docs/SCHEMA.md`
lines 1666, 2112), so this is schema-doc's existing behaviour and not a change of mine. Recorded for
whoever reads SCHEMA.md and believes it; not fixed in this job.

`SCHEMA.md` also prints `calendar_events — 2 rows` where the table holds 1. That figure is
`pg_stat_user_tables.n_live_tup`, which is approximate and still counted the verify block's rolled-back
probes.
