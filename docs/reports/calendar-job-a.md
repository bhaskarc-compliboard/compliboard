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

---

## A2 — the shared pieces, the date helper, the done tick

**Commit `cdf6c09`.** `npm run check`: **1020 of 1020**, floor 559 (was 960; +60 from the two new
suites). Cost after: **$18.82** — see the slip recorded below.

### ⚠ A SPEND SLIP, $0.36, MINE AND AVOIDABLE

Running the route probes against the isolated server, I wrote
`CHECK_LIVE_ONLY=calendar npm run check:live`. **`--only` is an argv flag, not an environment
variable** (`scripts/check-live.js:495–497`), so the variable did nothing and **the full paid answer
path ran**: 16 calls, **$0.36** (ledger 298 → 314 calls, $18.46 → $18.82). It was on Haiku, because the
server was started through `npm run haiku -- …`, so the bill is Haiku's and not Opus's.

The correct form, verified immediately afterwards and used from here on:

```
CHECK_LIVE_BASE_URL=http://localhost:3998 npm run check:live -- --only calendar
```

That run printed `--only calendar: the other /api/chat blocks are SKIPPED` and moved the ledger not at
all. **$0.36 of the $3 budget is spent, and none of it bought anything this job needed.**

### `lib/calendarDate.ts` — decision 15, B2

One place reads a `YYYY-MM-DD` string, and it reads it as a **calendar day at local noon**. Noon, not
midnight, because noon is the only hour no daylight-saving shift can move across a date boundary.
`today()` is Pacific (decision 15). Two things worth naming:

- **`nextOccurrence` clamps; it never overflows.** `setMonth` turns 31 January + 1 month into 3 March,
  which invents a date the rule never set *and moves the deadline later than it was due*. So the 31st
  becomes the last day of the target month: 31 Jan + monthly → **28 Feb**, 29 Feb + yearly → **28 Feb**
  the next year, 31 Mar + quarterly → **30 Jun**. Earlier is the safe direction for a deadline.
- **A day that does not exist is refused, not rolled forward.** `new Date(2026, 1, 30)` silently becomes
  2 March; `parseDay('2026-02-30')` returns null. A date nobody could write down must not quietly
  become a different date we then act on.

**`tests/unit/calendarDate.test.ts` — 24 tests.** Every case the map's 2b printed is an assertion, and
the suite pins `TZ=America/Los_Angeles` itself rather than trusting the runner's. It also pins **the
defect**, so nobody "fixes" the helper back:

```js
assert.equal(new Date('2026-11-01').getDate(), 31)   // the old expression, in Oregon
assert.equal(parseDay('2026-11-01')!.getDate(), 1)   // the helper
```

and the four things a person saw: a date due today is not past and is inside the next 30 days; the 1st
belongs to **next** month; on the evening of 31 October, 1 November is "Due tomorrow"; and `dueWords`
never prints `in -22 days`, which is what the dashboard showed for a passed date.

### `lib/calendarDates.ts` — decisions 7, 8, 9

**`addDate` is a compare-and-set.** It inserts and reads Postgres's `23505` as "already there" — never
check-then-insert, which is the shape of B8 (Documents' button checks `calendar_event_id` and then
inserts, so two crossing presses both pass). Four outcomes, and three of them are normal:
`created`, `already`, **`rejected_before`** (decision 6: a person said no to this exact date, so a later
reading must not raise it again), and `refused` for a caller's own mistake.

**The key, and the two staging rows that chose it.** `source:ref:day:normalisedLine`, with `hand` keyed
on its own id because a person pressing Save is the authority on whether it is a second date. The line
is normalised by `normaliseForQuote` — the rule that **already exists** (`lib/documentScan.ts:194`),
which HR's quotes and the scan's own quote check use, by the owner's decision of 7 October that there
is one normalisation rule. Two tests name the rows that settled it:

- *the re-read case*: `13-company-self-check.docx` renamed a deadline completely while its normalised
  line was byte-identical — so a title-based key would have made a second date;
- *the fire-extinguisher case*: `11-fire-extinguisher-certificate.pdf` has a 6-year internal maintenance
  **and** a monthly visual inspection both on 2026-10-31 — so a (document, day) key would have merged
  two real obligations and lost one.

**`markDone` makes the next occurrence and keeps the done one** — one row per occurrence, because "we
did this in January and again in February" is the history the product exists to keep. A repeat with no
"how often" makes nothing **and says why**, rather than guessing yearly (B4).

**`withdrawStale` throws rather than withdrawing everything** when the current-dates view cannot be
read. That is the map's own lesson turned on this code: an unreadable view returns no rows, every date
then looks stale, and a silent "0 current dates" would have withdrawn the company's whole calendar.
There is a test for exactly that.

**`siblingsOnDay` is shown and never acted on** — the owner's answer of 9 October. It is not used to
suppress a write, and a test asserts both dates still exist afterwards, because the fire-extinguisher
row proves a suppressing match would tell a person "already on your calendar" about a different
obligation.

**`tests/unit/calendarDates.test.ts` — 36 tests**, over a stand-in client that enforces the one thing
this code leans on: `unique (company_id, date_key)`, returning `23505`. It also computes
`counts_as_due` the way migration 073's generated column does. *Three true tests failed first* because
the stand-in computed that column at read time instead of storing it, so `.eq('counts_as_due', true)`
had nothing to filter on — a stand-in has to be faithful about the thing under test.

### `app/api/calendar/dates` — decision 8

POST add, PATCH confirm / reject / done, GET for the three tabs, every method through
`requireCompany`. Two rules worth stating:

- **The state is not taken from the body.** It follows from the source: a document's dates arrive
  `not_confirmed`, and a date a person pressed for — audit, summary, by hand — arrives `confirmed`,
  because pressing it *is* the confirmation. A client that could name the state could confirm its own
  dates.
- **Every id in the body is read through the caller's own client first** (§3.6), so another company's
  document, deadline, conversation, finding, handbook or site is simply absent and answers **404, not
  403**.

### The done tick — B1, fixed

`app/calendar/page.tsx`: the token is sent, **and the answer is read**. A failure puts the tick back and
says so. It needed its own notice: `saveError` is rendered *inside* the Add form, so with the form
closed the message would have been swallowed — which is the same class of fault as the original bug.

### `check:live` gains the calendar — B17

The file touched neither `calendar_events` nor `/api/calendar` before, which is why the tick's 401 went
a month without an instrument. On 3999 (free, table probes only):

```
✓ calendar_events            anon refused read — 42501
✓ document_dates_current_v   anon refused read — 42501
✓ calendar_events            anon refused insert — 42501
✓ calendar_events            authenticated can read
✓ document_dates_current_v   authenticated can read
✓ calendar_events            authenticated can insert — state confirmed, counts_as_due true
✓ calendar_events            refused for another company — 42501
✓ calendar_events            the key refused the same date twice — 23505
✓ calendar_events            refused another company's document — 23503
✓ calendar_events            refused another company's site — 23503
✓ calendar_events            refused another company's conversation — 23503
✓ calendar_events            refused another company's finding — 23503
✓ counts_as_due              a date with no day is not due — counts_as_due false
✓ counts_as_due              an unfound line is not due — counts_as_due false
✓ counts_as_due              confirming it puts it back on — counts_as_due true
✓ calendar_events            a one-off with no day is refused — 23514
✓ calendar_events            a rejection with no reason is refused — 23514
✓ calendar_events            authenticated can delete — 3 probe row(s) removed
✓ calendar_events            no probe row left behind — 0 found
```

And the route, against the isolated Haiku server on 3998:

```
✓ calendar no session  POST 401, PATCH 401, GET 401, old PATCH 401
✓ calendar refusals    no title 400, bad day 400, bad source 400, unknown document 404
✓ calendar write       add 200 created true, second add 200, list 200 (0 to confirm)
✓ calendar actions     done 200, reject with no reason 400
```

**One probe reported a failure and was right to.** The view probe first asked for `id`, which
`document_dates_current_v` does not have — it has `deadline_id`. PostgREST answered **42703, undefined
column**, not 42501, and the probe failed. An error of another kind looks exactly like a refusal and
proves nothing, so each probe now names a column it really has. That is the rule catching my own code,
in the file written to catch it elsewhere.

---

## A3 to A5b — the checkpoints after A2

Each is recorded in full in its commit message and in `DECISIONS.md` §185a–§185c and §186. This
section carries only what a later reader needs that is not in those.

| Checkpoint | Commit | Tests | Job A spend |
|---|---|---|---|
| A3 — Documents into the calendar | `42253da` | 1024 | $0.40 |
| A3b — a failed reading withdraws nothing | `86187b1` | 1031 | $0.40 |
| A3c — migration 075, dates | `bd076ec` | 1034 | $0.40 |
| A4 — Audits' button | `718b22c` | 1035 | $0.40 |
| A3d — migration 076, identity | `69876e6` | 1038 | $0.40 |
| A3e — the content sweep | `c02f4f2`, `621490d` | 1046 | $0.40 |
| A5 — the monthly email | `e8c59a5` | 1066 | $0.40 |
| A5b — board 12's words, and §185c | `a9bb256` | 1071 | $0.40 |
| A6 / A7 — the record and the gate | this commit | **1072** | **$0.56** |

---

## A7 — the cross-section gate

### Part 1 · `npm run check` after every checkpoint

Run at each of the nine checkpoints above; the count is in the table and the floor was raised to it
every time, by the owner's rule of 9 October. **960 → 1072**, floor **1072**. Never red at a
checkpoint.

### Part 2 · Row counts per section, before A1 and after A5

Both as the signed-in caller and as the service role (`scripts/calendar-rowcounts.mjs`).
**Caller and service role were identical on every table for every person, both times** — so no read
narrowed.

```
  table                        testalpha       testgamma     testcascade
  ------------------------------------------------------------------------
  topics (workspace)                   0        23 -> 28               0
  topics (hr)                         19              39               0
  turns                               43      161 -> 178               0
  documents                            0               0              12
  document_scans                       0               0        13 -> 14
  document_deadlines                   0               0        38 -> 40
  document_index_v                     0               0              12
  fact_proposals                       1              26        50 -> 54
  company_facts                        0               0               1
  audit_runs                           0               0               0
  audit_sections                       0               0               0
  audit_findings                       0               0               0
  handbooks                            3              10               1
  handbook_checks                      4              27               0
  calendar_events                      0               1          0 -> 2

  cells that moved: 6
```

**Every one accounted for by Job A's own writes:**

| Cell | Caused by |
|---|---|
| `testcascade` document_scans +1, document_deadlines +2, fact_proposals +4, calendar_events +2 | A3's ONE live "Read it again" on `11-fire-extinguisher-certificate.pdf` (Haiku, $0.040617) |
| `testgamma` topics +5, turns +17 | `check:live`'s own questions, created 18:59–19:02 UTC — the $0.36 slip that ran the full paid answer path. Checked, not assumed: the five topics are *"What is an SDS under OSHA HazCom?"*, *"What did I just ask about?"* and three more of check:live's fixed questions |

Two throwaway companies from crashed replay runs were found on staging during A5 and removed; the
replay now cleans up on `uncaughtException` and `unhandledRejection`. **6 companies**, as before.

### Part 3 · The shared-file lists

Read from `docs/TEST-AT-FINISH-LINE.md` HR J and `docs/HANDOFF-FROM-HR.md` §6. **Two of the files Job
A changed are on HR's list:**

| File | Whose list | Why Job A touched it | Re-run |
|---|---|---|---|
| `lib/documentScan.ts` | HR J, §6 (for `normaliseForQuote`) | the deadline quote check, the calendar step, and A3e's swap | HR 213 unit tests, `check:live --only hr_answer` |
| `vercel.json` | HR J, §6 (the cron entries) | the `calendar_month` entry | the cron pin test; both HR jobs run by hand (part 5) |

`normaliseForQuote` itself **moved** to `lib/normaliseQuote.ts` and is re-exported from
`lib/documentScan.ts`, so every HR import is unchanged — HR's suite proves it.

`lib/attachedDocument.ts` is on NEITHER list but is used by the Workspace **and** HR through
`/api/chat`; A3e changed it (one swap) and both sections' checks re-ran.

### Part 4 · Every page still loads, and shows its rows

An isolated server on 3998 under the Haiku guard, signed in as `testcascade@example.com`.

| Page | Loads | BLOCKED |
|---|---|---|
| `/dashboard` | ✓ "Cascade Specialty Chemicals, LLC" | (0) |
| `/documents` | ✓ 900 column, its list, and the report drawer with its dates row | **(0)** |
| `/audits` | ✓ both tabs | **(0)** |
| `/compliance` | ✓ | **(0)** |
| `/hr` | ✓ | **(0)** |
| `/company-information` | ✓ | (0) |
| `/calendar` | ✓ the old page, until Job B | **(0)** |
| `/account` | ✓ | **(0)** |

`BLOCKED (0): nothing — no paid route and no write was attempted` on every one: the screenshots cost
nothing and changed nothing. Shots in `shots/calendar-a7-*.png`, and
`shots/calendar-a7-documents-report.png` shows the drawer's new date row — *"On your calendar · not
confirmed · Confirm"* under the date, with its source line beneath.

### Part 5 · The nightly jobs

```sql
select pg_get_constraintdef(oid) from pg_constraint where conname='job_runs_job_check'
→ CHECK ((job = ANY (ARRAY['summarise','delete','account_delete','scan_documents',
                           'audit_sections','handbook_checks','calendar_month'])))
```

All six old names, plus `calendar_month`. Each job run by hand with `x-cron-secret`:

| Job | Answer | `job_runs` |
|---|---|---|
| scan-documents | `"run": null`, 0 companies | none — no work, as before |
| audit-sections | `"run": null`, 0 companies | none — no work, as before |
| handbook-queue | queued 0, not_due 9 | **ok=true** (it records under the name `handbook_checks`, `route.ts:26`) |
| handbook-checks | 0 pieces | none — no work, as before |
| delete | 0 topics cleared | **ok=true** |
| summarise (Haiku) | considered 30, summarised 30, 9 proposals, 0 errors | **ok=true** |
| calendar-month | sent 1, nothing_to_say 5, failed 0 | **ok=true** (A5) |

### Part 6 · The emails

`tests/unit/calendarNotify.test.ts`: all four senders import `lib/emailSender.ts`, none holds the
literal address any more, and **with `EMAIL_FROM` unset every one sends from exactly the address it
used before** — so adding the constant changed no email that goes out today.

### Part 7 · `check:live` on 3999 at the end

`check:live: ok — 6 tenant table(s): 3 writable by a signed-in user, 3 read-only to them by design,
all 6 refused to anon; and HR's 6 tables (066), each allowing and refusing exactly its grant.`
Every section's table probes green, including the calendar's 19 new ones.

### Part 8 · The golden sets are NOT re-run (they are paid)

| Set | Would it move? | Why |
|---|---|---|
| **Documents'** | **No.** | `saveScan` writes one more column (`document_deadlines.quote_verified`) and then calls the calendar. **Nothing the model sees or writes changed**: no prompt, no schema, no context. The stored answers under `tests/golden/documents/runs/real-model/` are replayed through the same `saveScan` by A3's own proof, and the scan rows are byte-identical. |
| **Audits'** | **No** for the model's output; **yes** for a fixture whose latest reading failed. | `lib/audit.ts` reads the same four tables, keyed on the readable reading instead of the current one. For every fixture — none of which has a failed reading — `readable_scan_id` **is** `scan_id`, so the input the model is handed is unchanged. The one case that would move is the one A3e was about, and it moves from *"the permit is on file and says nothing"* to the permit's actual words. |
| **HR's** | **No.** | `normaliseForQuote` moved file and is re-exported; HR's 213 tests prove the imports. |

---

## What is not done, and what is owed

- **The page is Job B.** The three tabs, the drawer, To confirm with Confirm all, "Add a date",
  repeats on screen, print, and retiring the import (decision 17).
- **Dates in Workspace and HR summaries** (step 7) — a quality change, the owner's yes first.
- **Nothing is on production.** Migrations 073–076 are on staging only.
- **The monthly email reaches no customer** until §185b's two gates: the sending domain (decision 22)
  and My Account's off switch.
- **`docs/TEST-AT-FINISH-LINE.md` Calendar H** is the one thing Job A could not test: a real re-read
  on Opus, because no fixture holds two stored readings and A3's replay applied the drift by hand.
- Four rows in `docs/HANDOFF-CODE.md` §7 for other sections: Audits reading every version's dates,
  the gap-split heading's words, a never-read document's "nothing" in an audit prompt, and
  `scripts/schema-doc.js` filing a composite key under its first column.
