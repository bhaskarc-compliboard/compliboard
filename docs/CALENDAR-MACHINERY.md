# The Calendar, and everything that touches a date — how it works, end to end

**Written:** 15 October 2026, Calendar section Step 3. **Read-only.** No code was changed, no migration was
applied, no model was called, and no reset or restore was run.
**Line numbers are from commit `2dab12c`** (branch `calendar-v2`, one commit ahead of `origin/main`, tree clean).
**Nothing from the branch `calendar-attempt-1` was read, cited or reused.**

**Method** (`CLAUDE.md` §9.1, `HOW-WE-BUILD.md` §3).
- Every claim points at `file:line`, a migration, or a query whose SQL and output are printed here.
- A claim that cannot point at a line is labelled **HYPOTHESIS**, with what would settle it.
- The schema facts come from the **live staging catalog**, not from `docs/SCHEMA.md`. Where the two
  disagree, the catalog wins and Part D says so.
- Grants are read with `has_table_privilege` for all eight rights, never from a grant list and never from
  `information_schema.role_table_grants` (blind from the CLI — `docs/HR-MACHINERY.md` B12).
- Row counts were taken **both as a signed-in caller and as the service role**, and the caller's client was
  first shown reading a table it should see, so "0" could be told from "blind" (`CLAUDE.md` §9a).

**Abbreviations.**
- `cal-page` = `app/calendar/page.tsx` (601 lines)
- `cal-route` = `app/api/calendar/route.ts` (152 lines)
- `doc-actions` = `app/api/document-actions/route.ts` (208 lines)
- `dash` = `app/dashboard/page.tsx` (235 lines)
- Migrations are under `supabase/migrations/`.

---

## PART A — where we are

Every item was run; the raw output is in the session report. Summary:

| # | Check | Expected | Found |
|---|---|---|---|
| A1 | git | `calendar-v2`, clean, 1 ahead of `origin/main` | **As expected.** HEAD `2dab12c9e4ef2c3e4018a5e94264dfbb7ed1d45a`; `origin/main` `54ec6ae804c3fdf5868f9035f43845ab71b82701`; `git status --porcelain` empty; `git rev-list --left-right --count origin/main...HEAD` → `0 1`, the one commit being "Staging rebuilt from the 072 baseline on 14 Oct — the restore record" |
| A2 | highest migration on disk | 072 | **072** — `072_handbook_check_answers.sql`, 73 files |
| A3 | staging `schema_migrations` | 73 rows, highest 072 | **73 rows, highest `072`** |
| A4 | `npm run preflight` | 0 pending | **PENDING COUNT: 0**, and 0 applied-but-absent-from-disk. Target ref `dsfwmafnphdlfogetsus`; `PROD_URL` and `PROD_KEY` both blank, as §3.8 requires |
| A5a | `npm run check` | green | **green.** `check-schema-contracts: ok — 278 files, 55 relations (51 tables + 4 views)`; **tests 960, suites 283, pass 960, fail 0, skipped 0, todo 0** (`test-guard`: floor 559); `next build` completed |
| A5b | `check:live` on 3999 | green, free | **ok** — 6 tenant tables (3 writable by a signed-in user, 3 read-only by design, all 6 refused to anon) and HR's 6 tables. The paid steps **SKIPPED — no server at http://localhost:3999**, so the run cost nothing |

Nothing in Part A made this job stop.

### A6 Row counts on staging, as the caller and as the service role

Signed in as `testgamma@example.com` (company `7e61edca-e1d7-4a30-96ca-784c66b49fc2`, Test Gamma Solvents),
against ref `amzsavsrabrlcprltpom`:

| Table | As the caller | As the service role |
|---|---|---|
| `calendar_events` | 0 | **0** |
| `document_deadlines` | 0 | **37** |
| `handbook_dates` | 0 | **0** |
| `audit_findings` where `kind = 'date'` | 0 | **0** |
| `audit_findings`, all kinds | 0 | **0** |

**The caller's zeros are real, not blindness.** The same client read `requirement_templates` 205,
`switches` 95, `agencies` 33, its own `companies` 1 (service role: 6) and its own `profiles` 1
(service role: 5). The zeros are because **Test Gamma's tenant holds no date rows of any kind** —
all 37 `document_deadlines` and all 12 `documents` belong to **Cascade Specialty Chemicals, LLC**
(`95f7167d-1d3f-4004-bb44-dde80d0d4262`), which has no fixture login.

**`audit_findings` is EMPTY on staging**, so "0 rows with `kind = 'date'`" proves nothing about the
`kind` filter: the tally of distinct `kind` values read as the service role is `{}`. Stated rather than
reported as a pass. The cause is the 14 October rebuild from the 072 baseline (HEAD's own commit message).

Of the 37 `document_deadlines`: **26 carry a `due_on`**, **33 have `recurs = true`**, and **0 are linked to a
`calendar_event`** — so no row on staging has ever been through "Add to calendar".

---

## PART B — everything that touches a date today

### B1. `calendar_events`

**The table, read from the staging catalog.**

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `id` | uuid | no | `gen_random_uuid()` |
| 2 | `company_id` | uuid | **YES** | — |
| 3 | `user_id` | uuid | yes | — |
| 4 | `title` | text | no | — |
| 5 | `description` | text | yes | — |
| 6 | `due_date` | **date** | no | — |
| 7 | `category` | text | yes | — |
| 8 | `is_recurring` | boolean | yes | `false` |
| 9 | `recurrence_period` | text | yes | — |
| 10 | `completed` | boolean | yes | `false` |
| 11 | `completed_at` | timestamptz | yes | — |
| 12 | `created_at` | timestamptz | yes | `timezone('utc'::text, now())` |
| 13 | `entity_id` | uuid | yes | — |
| 14 | `document_id` | uuid | yes | — |
| 15 | `handbook_id` | uuid | yes | — |

**`company_id` IS NULLABLE**, which no other tenant table in the date family is (`document_deadlines` and
`handbook_dates` both have it `NOT NULL`). It is the oldest table here — `000_baseline.sql` — and the
column was never tightened. RLS still closes the hole for a caller (`company_id = auth_company_id()` can
never be true of NULL, so a null-company row is invisible and uninsertable through `authed.db`), but
**the service role can write a row belonging to nobody**, and such a row would survive a company deletion
because the cascade has nothing to follow. Nothing writes one today (both writers pass `companyId`:
`cal-route:56`, `doc-actions:141`).

**Constraints** (`pg_constraint`, staging):
- `calendar_events_pkey` — PRIMARY KEY (id)
- `calendar_events_company_id_fkey` — FOREIGN KEY (company_id) REFERENCES companies(id) **ON DELETE CASCADE**
- `calendar_events_user_id_fkey` — FOREIGN KEY (user_id) REFERENCES auth.users(id) **ON DELETE CASCADE**
- `calendar_events_document_id_fkey` — FOREIGN KEY (document_id) REFERENCES documents(id) **ON DELETE SET NULL**
- `calendar_events_entity_id_fkey` — FOREIGN KEY (entity_id) REFERENCES entities(id) **ON DELETE SET NULL**
- `calendar_events_handbook_in_same_company` — FOREIGN KEY (company_id, handbook_id) REFERENCES
  handbooks(company_id, id) **ON DELETE SET NULL (handbook_id)**

**There is no CHECK on this table at all.** Not on `category`, not on `recurrence_period`, not on
`completed_at` against `completed`. See B1's vocabulary note below and Part D5.

**Read the last constraint carefully.** `ON DELETE SET NULL (handbook_id)` is the column-list form: deleting
a handbook nulls **`handbook_id` only**, never `company_id`. Migration 066:585–588 verifies it from the
catalog (`confdeltype = 'n'`), and 066:580–582 asserts that after a handbook delete `handbook_id` is null
**and `company_id` is unchanged**. `docs/SCHEMA.md` describes it the other way round — Part D3.

**Indexes:**
- `calendar_events_pkey` — UNIQUE (id)
- `idx_calendar_events_company_handbook` — (company_id, handbook_id) WHERE handbook_id IS NOT NULL
- `idx_calendar_events_entity` — (entity_id)

**There is no index on `(company_id, due_date)`**, and that is the table's one read path: `cal-route:84–88`
does `.eq('company_id', …).order('due_date')`, and so does every page through it. `CLAUDE.md` §3.7 asks for
company-leading indexes; the only company-leading one here is partial on `handbook_id IS NOT NULL`, which
that query cannot use. Not a correctness fault, and worth one line in whatever migration the calendar
section writes.

**RLS policies** (all `to authenticated`, all through `auth_company_id()`):

| Policy | For | USING | WITH CHECK |
|---|---|---|---|
| `calendar_events_select` | SELECT | `(company_id = auth_company_id())` | — |
| `calendar_events_insert` | INSERT | — | `(company_id = auth_company_id())` |
| `calendar_events_update` | UPDATE | `(company_id = auth_company_id())` | `(company_id = auth_company_id())` |
| `calendar_events_delete` | DELETE | `(company_id = auth_company_id())` | — |

**Grants**, read with `has_table_privilege` for all eight rights:

| Role | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER | MAINTAIN |
|---|---|---|---|---|---|---|---|---|
| `anon` | — | — | — | — | — | — | — | — |
| `authenticated` | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| `service_role` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

`calendar_events` is **the only table in this family a signed-in person may INSERT and DELETE** — the
others are server-written. That is right for a calendar a person keeps, and it is why B10's absence of any
`check:live` probe matters.

**Every query that names it** (reproduced with `schema-doc.js`'s own matcher, `scripts/schema-doc.js:197–201`):

| Where | Line | What |
|---|---|---|
| `cal-route` | 22–30 | `ownedEvent()` — `select id, company_id` by id, through `authed.db`; a row of another company returns null and the caller answers **404, not 403** |
| `cal-route` | 53–65 | **INSERT.** `company_id`/`user_id` from the session, `title`, `description`, `due_date`, `category`, `is_recurring`, `recurrence_period`, `document_id` (proved owned at :48–51, else 404) |
| `cal-route` | 84–88 | **SELECT** `*` by `company_id`, ordered `due_date` ascending. Company-wide on purpose (:74–77: a compliance calendar is a company asset, not a person's) |
| `cal-route` | 111–118 | **UPDATE** `completed`, `completed_at` by id + company_id, after `ownedEvent` |
| `cal-route` | 141–145 | **DELETE** by id + company_id, after `ownedEvent` |
| `doc-actions` | 140–146 | **INSERT** from a `document_deadlines` row — B6 |
| `app/api/account/route.ts` | 220 | named in `COMPANY_SCOPED_TABLES`, so a company deletion clears it |
| `app/api/account/export/route.ts` | 91, 191, 216 | `byCompany('calendar_events')`, in the payload and in `row_counts` |

Only two writers exist and neither is a model: `cal-route` POST and `doc-actions`'s `deadline_to_calendar`.
`lib/documentScan.ts:701` states it in the negative — *"IT WRITES NOTHING TO `company_switches`,
`calendar_events` OR `document_reviews`"* — and migration 040:164 and 066:228 both say the same of their own
tables: **nothing writes a calendar event on its own; a person presses something.**

**`handbook_id` is written by nothing.** Migration 066:305–312 added the column; grep over `app/`, `lib/`,
`components/` and `scripts/` finds no write of it. `docs/HANDOFF-FROM-HR.md` §6 says so too, and it is
accurate.

**`category` has three vocabularies and no constraint.** `cal-page:20–23` offers ten words from a dropdown
(`OSHA`, `EPA`, `DOT`, `FDA`, `State License`, `Permit Renewal`, `Training`, `Inspection`, `Report`,
`Other`); `cal-page:210` writes the literal `'compliance'` for an imported date; `doc-actions:143` writes the
literal `'document'`; `DECISIONS.md` §11051 reserves `'hr'`. The list view prints whatever is there
(`cal-page:526`), so a calendar can show four words from four vocabularies, none of which the dropdown can
reproduce.

### B2. `document_deadlines`

**The table** (staging catalog):

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `id` | uuid | no | `gen_random_uuid()` |
| 2 | `scan_id` | uuid | no | — |
| 3 | `document_id` | uuid | no | — |
| 4 | `company_id` | uuid | no | — |
| 5 | `title` | text | no | — |
| 6 | `due_on` | **date** | yes | — |
| 7 | `source_line` | text | yes | — |
| 8 | `recurs` | boolean | no | `false` |
| 9 | `calendar_event_id` | uuid | yes | — |
| 10 | `created_at` | timestamptz | no | `now()` |

Created by `040_document_scan.sql:155–168`. **No CHECK constraint**: unlike `audit_findings` (B3), an
undated non-recurring deadline is storable here.

**Constraints:** `document_deadlines_pkey` (id); `company_id` → companies **CASCADE**; `document_id` →
documents **CASCADE**; `scan_id` → document_scans **CASCADE**; `calendar_event_id` → calendar_events
**SET NULL**. **Indexes:** `document_deadlines_pkey`, `idx_document_deadlines_document` (document_id) —
not company-leading, 040:168.

**Policies:** `document_deadlines_select_own` (SELECT) and `document_deadlines_update_own` (UPDATE), both
`(company_id = auth_company_id())`, with `WITH CHECK` on the update — 040:254–258. **No INSERT policy and
no DELETE policy.**

**Grants** (`has_table_privilege`): `anon` nothing; `authenticated` **SELECT + UPDATE only**;
`service_role` all eight. 040:232–234 revokes both roles then grants `select`, and 040:243 adds the one
UPDATE with its reason printed at 040:240–241: *"A person may correct a gap … and **confirm a deadline**, so
those two take UPDATE."*

**The writer — `lib/documentScan.ts`.** One insert, `:893–898`:

```
if (scan.deadlines.length) {
  const { error: e } = await db.from('document_deadlines').insert(scan.deadlines.map((d) => ({
    scan_id: scanId, document_id: documentId, company_id: companyId,
    title: d.title, due_on: d.due_on, source_line: d.source_line, recurs: d.recurs,
  })))
```

The values come from `normaliseScanRaw`'s `deadlines` mapping, `:340–343`: `title` falls back to
`'Untitled deadline'`, `due_on` goes through `date()` (a value that is not a date becomes null rather than
a bad string — `tests/unit/significantDate.test.ts` has the sibling case at :450 of the test log,
*"a date that is not a date is dropped, not passed to the database"*), `source_line` is a string or null,
and `recurs` is **`d?.recurs === true`** — anything else is false, never null.

**`chooseSignificantDate` — `lib/documentScan.ts:235–285`**, called only from `normaliseScan` at
`:376–379`, which overwrites the model's own `significant_date` with it (`:323–325` sets the field to null
as a placeholder and says the model's pick is *"deliberately discarded"*). The rule by kind:

| Kind | The date promoted |
|---|---|
| `permit`, `certificate` | the latest non-recurring dated deadline whose **title** matches `/expir/i` (`:249–250`); else the latest non-recurring dated deadline (`:254`); kind `'expiry'`. If neither exists, the document's own date with its own kind, usually `issued` (`:263`) — so a past issue date is not reported as an expiry |
| `program`, `policy` | its own `doc_date`, kind `revised` unless `doc_date_kind` matches `/revis|effective/i` (`:268–271`) |
| `record` | `doc_date` as `last_entry`; else the latest dated deadline (`:274–280`) |
| `supplier_document` | `doc_date` as `revised` (`:282–284`) |
| anything else | `doc_date` with its own kind (`:286`) |

`:247` matches **the title only, not the source line**, and the comment says why: on golden case 02 the
renewal deadline's source line quotes *"120 days before the expiration date"*, so matching the source line
made the deadline that **mentions** the expiry beat the one that **is** it.

**`document_index_v` recomputes the same rule in SQL at read time** — migration 049, and the live view
definition (read with `pg_get_viewdef` on staging) contains three LATERAL joins over `document_deadlines`:

```
expiry      : due_on IS NOT NULL AND NOT recurs AND title ~* 'expir'   ORDER BY due_on DESC LIMIT 1
latest      : due_on IS NOT NULL AND NOT recurs                        ORDER BY due_on DESC LIMIT 1
latest_any  : due_on IS NOT NULL                                       ORDER BY due_on DESC LIMIT 1
```

and derives `significant_date`, `significant_date_kind` and `display_status` from them, with `expired` and
`expiring` (90 days) **both requiring `significant_date_kind = 'expiry'`**. The view is
`security_invoker = true` (read from `pg_class.reloptions`), `anon` cannot select it, `authenticated` can.

**So the same rule lives in two places** — TypeScript in `documentScan.ts:235–285` and SQL in the view — and
they are kept in step only by hand. That is deliberate (049 moved it to read time so a stored derived field
could not go stale, and `components/AuditReport.tsx:108` quotes the reasoning), and it is a thing a calendar
change must not break in one place only.

**Every reader:**

| Where | Line | What it reads |
|---|---|---|
| `app/api/documents/report/route.ts` | 43 | `select *` by `document_id`, ordered `due_on` (nulls last) then `title` — the document report drawer's "Dates this document sets" |
| `app/api/audits/index/route.ts` | 75–81 | `document_id, title, due_on, recurs, source_line` by `scan_id`, then filtered **in code**: kept when `(recurs && !due_on)` or `due_on <= soon` |
| `lib/audit.ts` | 174–178 | `document_id, title, due_on, recurs` by `scan_id`, ordered — part of the audit prompt's context block |
| `doc-actions` | 130–132 | one row by id, for `deadline_to_calendar` (B6) |
| `doc-actions` | 148–150 | **UPDATE** `calendar_event_id` — and it uses `supabaseAdmin`. Part D6 |
| `document_index_v` | migration 049 | the three LATERALs above |
| `scripts/check-live.js` | 1059–1062 | seeds one probe row, `title: 'Permit expires'`, `due_on: '2027-01-01'`, `recurs: false` — the title is what makes the probe document read as expiring (`:1028–1032`) |
| `app/api/account/route.ts` | 240 | in `DELETED_BY_CASCADE_OR_PARENT`, with the reason: `company_id` → companies CASCADE, read from `pg_constraint` on 25 Sep |

### B3. `audit_findings` rows with `kind = 'date'`

**The CHECK, migration `060_a_recurring_date_need_not_have_a_day.sql:56–59`**, and the live catalog agrees:

```
CHECK ((kind <> 'date' OR due_on IS NOT NULL OR recurs IS TRUE))
```

060 replaced 058's `kind <> 'date' or due_on is not null`. The WHY is 060:4–50: across fifteen baseline runs
the model returned eighteen items shaped `{"title": "Annual permit fee (Condition 6.2)", "due_on": null,
"recurs": true}` — true, useful, and with no day, because the permit says *annual* and the day is on an
invoice nobody has. The old CHECK refused them, `lib/auditRun.ts` demoted them to findings, and a `dates`
item carries no `word`, so **23 rows in fifteen runs landed as a title with no word at all**.

060:42–46 explains `recurs is true` rather than `coalesce(recurs, false)`: `recurs` is nullable and null
means *the model did not say*, which is not a recurring obligation. 060's own verify block tests all four
directions — the new case accepted (:86–104), a non-recurring undated date refused (:107–112), a date with
`recurs` null refused (:118–123), dated dates unaffected (:126–135) — plus the cross-tenant FK (:155–168)
and a privilege read-back (:171–179). A constraint nobody has tried to break is a comment; this one has been
broken four ways on purpose.

**Who writes `due_on` and `recurs` — `lib/auditRun.ts`, two shapers, one insert at `:497`.**

1. **`shapeFindings` (the agency audit).** `KINDS` at `:33` maps the model's `dates` field to `kind: 'date'`.
   - `:645–648` — a `date` item with no `due_on`: **kept as a date if `item.recurs === true`**, otherwise
     pushed to `droppedUndated` and `continue`d. Never given an invented day.
   - `:666–672` — **a `nothing_on_file` finding whose `due_on` is in the future becomes a date**, `word`
     nulled, and the move recorded in `reshaped`. The reason at `:658–665`: the first DEQ runs wrote "Annual
     report for reporting year 2026 — nothing on file" against a report due 15 February 2027. *"Nobody has
     failed to do something they still have five months to do."* `today` comes from
     `opts.today ?? input.today ?? new Date()` (`:581`) so one run judges and shapes against one date.
   - `:683–686` — the backstop: a finding with no word is dropped to `droppedWordless`, never shown.
   - `:703–704` — `due_on: useKind === 'date' ? due : null`, `recurs: typeof item.recurs === 'boolean' ? item.recurs : null`.
2. **`shapeTemplateFindings` (the checklist audit).** `:865–869` applies the same not-yet-due rule; `:880–881`
   writes the same two fields the same way.

Both counts are stored on the run and reported: `reshaped_to_dates` and `dropped_undated`
(`:65–67`, `:518–519`, read back at `:1241–1248`), because — `:593–594` — *"a rule that fires silently is a
rule nobody can tell is firing."* `:1217` counts `dates_passed` as `kind === 'date' && passed === true`.

**Grants and policies:** `anon` nothing; `authenticated` **SELECT + UPDATE only** (060:176–179 reads it
back); `service_role` all eight. Verified again here with `has_table_privilege`.

**Where the page shows them.**

- **`components/AuditReport.tsx`** — `:61` the row type carries `due_on`, `recurs`, `passed`; `:442` a
  section counts as needing a person if any open finding is a date; `:486–489` the sort: **passed first, then
  by date, and a recurring date with no day last**; `:1016–1060` the "Dates" section itself.
  - `:1032` `const undated = !f.due_on`
  - `:1043` an undated row reads `— recurs, no date in the reading` in words, not a blank
  - `:1051–1055` **"Add to calendar" is rendered only when `!undated`** — `:1029–1030` says why: *"the link
    would put a row on the calendar with no date, which is the same false precision one step further on."*
  - the link is `` `/calendar?add=${encodeURIComponent(f.title)}&on=${f.due_on ?? ''}` ``
- **`app/audits/page.tsx`** — `:38–40` the `Deadline` type, `:72` `deadlines` on the index payload, `:853`
  `deadlinesFor`, `:891–911` the lines. Note these are **`document_deadlines`, not `audit_findings`**: the
  agency groups print the dates the documents set. `:892` deduplicates by `document_id|title` because a
  document listed under five subjects printed its two deadlines five times; `:901–909` refuses to tell an
  undated recurring deadline that it has passed, and the comment names the defect it replaced — reading
  `source_line` into the gap where a month and day should go, then claiming *"passed for 2026"* about a date
  nobody has.

### B4. `handbook_dates`

**The table** (staging catalog), created by `066_hr_handbooks_and_their_check.sql`:

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `id` | uuid | no | `gen_random_uuid()` |
| 2 | `handbook_id` | uuid | no | — |
| 3 | `company_id` | uuid | no | — |
| 4 | `check_id` | uuid | yes | — |
| 5 | `title` | text | no | — |
| 6 | `due_date` | **date** | yes | — |
| 7 | `recurs` | boolean | no | `false` |
| 8 | `quote` | text | yes | — |
| 9 | `quote_verified` | boolean | yes | — |
| 10 | `source` | text | no | — |
| 11 | `source_url` | text | yes | — |
| 12 | `calendar_event_id` | uuid | yes | — |
| 13 | `created_at` | timestamptz | no | `now()` |

**Constraints:** `handbook_dates_pkey`; `handbook_dates_source_check` — `CHECK (source = ANY (ARRAY['handbook','rule']))`;
`company_id` → companies **CASCADE**; `(company_id, handbook_id)` → handbooks(company_id, id) **CASCADE**;
`(company_id, check_id)` → handbook_checks(company_id, id) **SET NULL (check_id)**; `calendar_event_id` →
calendar_events **SET NULL**. **Index:** `idx_handbook_dates_company_handbook` (company_id, handbook_id).
**Policies:** `handbook_dates_select_own`, `handbook_dates_update_own`. **Grants:** `anon` nothing,
`authenticated` SELECT + UPDATE, `service_role` all eight — the same shape as `document_deadlines`, and
`scripts/check-live.js:219–220` says so in as many words.

**Does any code in `app/` or `lib/` read or write it today? NO.**

Grep over `app/` and `lib/` for `handbook_dates` returns four kinds of hit and not one of them is a query:
`lib/database.types.ts:2596` and its four FK names (generated types),
`app/api/account/export/route.ts:103, 202, 227` (`byCompany`, a dynamic `.from(table)`), and
`app/api/account/route.ts:217` (a string in the deletion list). Run against `schema-doc.js`'s own
`.from('literal')` matcher, `handbook_dates` resolves to **`scripts/check-live.js` and nothing else**.

In particular **`lib/handbookCheck.ts` does not touch it.** Its `.from(` calls are `handbooks` (:119),
`handbook_sections` (:125), `handbook_checks` (:131), `handbook_check_sections` (:142), `entities` (:302)
and `ai_calls` (:363). `docs/SCHEMA.md` says otherwise — Part D1.

The only exercise it gets is `scripts/check-live.js:262–277` and `:298–299`: the service role writes a probe
row, the signed-in person **can UPDATE it** ("Add to calendar marks it", :262–263), is **refused INSERT**
(42501) and **refused DELETE** (42501), and the row **goes with its handbook** on delete (0 left). That is
the most thoroughly probed of the four date tables, and nothing in the product writes to it.

It is parked on purpose: `docs/HANDOFF-FROM-HR.md` §8 lists *"The handbook's dates and 'Add to calendar'; the
Dates tab"* as parked with the structured check, returning with switch 5, and §5 names the unpushed local
branch `parked/hr-check-structured` (`391fd05`) that holds the work. **That branch was not read for this
document.**

### B5. `/api/extract-dates`, `prompts/extract-dates.ts`, and `cal-page`

**`app/api/extract-dates/route.ts` (95 lines).** POST only.
- `:18–20` `requireCompany` **before the body is read**, so an unauthorised caller never reaches the parser
  and never costs anything. `:8–17` records that this route had no session at all until 28 September — an
  anonymous POST could have a file read by a paid model call recorded against no tenant.
- `:26–33` `formData`; **no file at all returns `{ dates_found: [] }` with no `extraction_failed`.**
- `:38` `parseDocumentToBlocks` (`lib/documentContent.ts`, shared with `/api/chat` and HR).
- `:39–55` a parse failure returns `{ dates_found: [], extraction_failed: parsed.failure }` **and still 200**,
  because the route runs behind an upload and must not fail it. The comment at `:44–54` is the worked example
  of `CLAUDE.md` §5.1.
- `:67–70` `askAIJson(EXTRACT_PROMPT, …, { maxTokens: 1000, ledger: { companyId, task: 'other' } })`. **The
  ledger task is `'other'`, not a calendar task** — see C7.
- `:72` `return NextResponse.json(result)` — **the route writes to no table.** It has no database client at
  all beyond `requireCompany`'s.
- `:73–93` a thrown error returns the third shape: `dates_found: []` plus
  `extraction_failed.reason = 'extraction_error'` with our-fault words.

**`prompts/extract-dates.ts:6–35`, `EXTRACT_PROMPT`.** One string, edited freely by design. It asks for
expiry, renewal, inspection, licence, permit-end, annual-review dates and "any compliance deadlines", returns
`{ dates_found: [{ title, date, description, is_recurring, recurrence_period }] }`, sets `is_recurring` and
`"annually"` when the document mentions annual renewals, and caps at **10 dates**, **future or within the
last 30 days**.

**It is an unanchored enumeration of one document, which is the anchored case** — the document is the
artifact (`CLAUDE.md` §3.3). But the prompt decides *which* dates matter, where
`chooseSignificantDate` (B2) decides that in code for the document scan and says *"There is nothing here for
a model to decide"* (`documentScan.ts:222`). The two paths disagree about who owns that judgement. That is a
product question for the calendar section, not a defect, and is flagged rather than answered here.

**Every caller: one.** `cal-page:170–172`, in `handleImport`. Grep over `app/`, `lib/`, `components/` and
`scripts/` finds no other fetch of `/api/extract-dates`. `docs/INVENTORY-2026-09.md:150` and `:164` say the
same and add the decision: *"the feature itself — importing dates from a file rather than reading them off
obligation cadence — is the Calendar section's to keep or remove."*

**`cal-page` (601 lines), everything it does.**

| Piece | Lines | What |
|---|---|---|
| `CalendarEvent` type | 8–18 | nine fields; **`document_id`, `entity_id` and `handbook_id` are not among them** |
| `CATEGORIES` | 20–23 | the ten-word dropdown |
| `?add=` / `?on=` | 78–88 | B7 |
| load | 98–119 | `auth.getUser`, `profiles.company_id`, then `GET /api/calendar` with `authHeaders()` |
| `handleAddEvent` | 121–156 | POST with `authHeaders`, **checks `res.ok`** (:142), inserts into local state sorted by `due_date` |
| `handleImport` | 158–195 | POST the file to `/api/extract-dates` with `authHeaders()` (:170–172; FormData, so no Content-Type by hand); `dates_found` non-empty → `pendingDates` with all selected; `extraction_failed` → `alert(json.extraction_failed.message)`; otherwise `alert('No compliance dates found in this file. …')` — **and that third branch is now true, because the second one exists** (:179–189) |
| `handleAddToCalendar` | 197–229 | one POST per selected date, `category: 'compliance'` hard-coded (:210) |
| `toggleComplete` | 231–239 | **sends no Authorization header** — Part D7 |
| `deleteEvent` | 241–245 | `confirm()`, optimistic removal, DELETE with `authHeaders` |
| `exportToGoogleCalendar` | 247–251 | a `calendar.google.com/render?action=TEMPLATE` link, same day start and end |
| `exportToOutlook` | 253–256 | an `outlook.live.com/calendar/0/deeplink/compose` link |
| derived lists | 258–280 | `eventsThisMonth`, `getEventsForDay`, `upcomingEvents` (0–30 days **and `!completed`**), `overdueEvents` (`due < today` **and `!completed`**) |
| import panel | 331–350 | the picker; `:342` `accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.pptx,.ppt"` — **no images, though `parseDocumentToBlocks` reads them** (`lib/documentContent.ts:76–77, 143`). `docs/TODO.md:2799` records this and it is still open |
| add form | 352–417 | title, due date, category, description, a recurring toggle with monthly/quarterly/annually |
| month grid | 424–497 | a day cell opens the add form prefilled with that day (:453); at most two event titles then "+n more" |
| list view | 499–548 | per-row overdue / due-soon / "Due in n days"; `:526` prints `category` verbatim |
| empty state | 500–509 | "No deadlines yet" — true: it is `events.length === 0`, not a claim about documents |
| pending-dates sheet | 551–596 | the picker over extracted dates, with Skip |

This page is **the oldest UI in the product and the only one not built to the current design**: Tailwind
utility colours (`green-700`, `amber-50`) rather than the `var(--green)` / `var(--amber)` tokens the rest
uses, `alert()` and `confirm()` rather than `components/Sheet.tsx`, and none of `AppLayout`'s siblings —
no `Tabs`, `Drawer`, `Empty`, `buttonStyles` or `printFrame` (C6). It imports exactly two shared things:
`createClient`/`authHeaders` from `lib/supabase` and `AppLayout`.

### B6. `deadline_to_calendar`

**`doc-actions` (208 lines)** is one route with seven verbs, all POST, each on one document the caller owns.
`:32–34` `requireCompany`; `:44–46` **the one ownership check for every branch**, through `authed.db`, 404
rather than 403.

**`case 'deadline_to_calendar'` — `:127–152`:**
1. `:129` `deadline_id` required.
2. `:130–135` load the deadline through `authed.db` and **check `dl.document_id !== documentId`** → 404. So
   both the document and the deadline are proved.
3. `:136` already linked → `{ ok: true, already: true }` — idempotent, no second event.
4. `:137–139` **no `due_on` → 400, `'That deadline has no date to add.'`** The same refusal
   `AuditReport.tsx:1051` makes by not drawing the link at all.
5. `:140–146` INSERT into `calendar_events` through `authed.db`: `company_id`/`user_id` from the session,
   `title` from the deadline, `description` from its `source_line`, `due_date` from `due_on`,
   **`category: 'document'`**, `is_recurring: !!dl.recurs`, `recurrence_period: dl.recurs ? 'annually' : null`
   — **recurrence is always annual when it recurs, because `document_deadlines` holds no period column** —
   and `document_id`.
6. `:148–150` UPDATE `document_deadlines.calendar_event_id` **through `supabaseAdmin`**. Part D6.

**The button — `components/DocumentReport.tsx:810–838`**, section 6, "Dates this document sets". `:815`
`past = !d.recurs && isPast(d.due_on)` (`isPast` at `:110`). `:825–826` a linked deadline reads
**"In your calendar"**, plain grey, no action. `:827–831` otherwise, **only when `d.due_on` is truthy**, a
"Add to calendar" button calling `act({ action: 'deadline_to_calendar', deadline_id: d.id })`. So all three
layers — the view, the route and the migration's comment at 040:164 — refuse to put an undated row on the
calendar.

### B7. The Audits link, and `?add=` / `?on=`

**`components/AuditReport.tsx:1052–1055`** renders
`` /calendar?add=<encodeURIComponent(f.title)>&on=<f.due_on ?? ''> `` as a plain `<a>`, class `no-print`, and
only for a dated finding (B3).

**`cal-page:78–88`** reads it:

```
const params = useSearchParams()
useEffect(() => {
  const add = params.get('add')
  if (!add) return
  setNewTitle(add.slice(0, 200))
  const on = params.get('on')
  if (on && /^\d{4}-\d{2}-\d{2}$/.test(on)) { setNewDate(on); setSelectedDate(on) }
  setShowAddForm(true)
}, [params])
```

- `add` is **truncated to 200 characters** and put in the title field.
- `on` is accepted **only if it matches `^\d{4}-\d{2}-\d{2}$`** — anything else leaves the date blank for the
  person to pick, rather than guessing (`:84–85`).
- The add form opens. **Nothing is written.** The person presses Save, which is `handleAddEvent` (B5).
- The page is wrapped in `<Suspense>` (`:38–44`) because `useSearchParams` requires it.

`:68–77` records why this exists: the link *"sent `?add=<title>&on=<date>` and **this page read no parameter
at all**"* — so it looked like an action and was a navigation. Found in Audits Run 3b, item 5.

**Note for the calendar section:** `?add=` carries no `document_id`, no `audit_finding_id` and no agency, so
an event created this way **cannot say which finding it came from**. `cal-route:59–62` says `document_id` is
there to answer *"where the date came from"* and that *"a calendar event that cannot say which document set
it is a date nobody can check"* — and the Audits path cannot fill it. `cal-page` never sends `document_id`
on any POST, so the only populated `document_id` values come from `doc-actions:145`.

### B8. The dashboard

**`dash` reads the calendar through the route, not the table.**
- `:16` `interface CalEvent { id: string; title: string; due_date: string }` — three fields.
- `:64–66` `fetch('/api/calendar', { headers: await authHeaders() })`, inside a `try`; a failure sets
  `events` to `[]` silently (`:67`).
- `:106–111` the filter:

```
const now = new Date()
const in30 = new Date(); in30.setDate(now.getDate() + 30)
const upcoming = events
  .filter(e => { const d = new Date(e.due_date); return d >= new Date(now.toDateString()) && d <= in30 })
  .sort((a, b) => a.due_date.localeCompare(b.due_date))
```

- `:113–116` `daysUntil`, floor-of-today based.
- `:207–229` the render: heading "Upcoming — next 30 days"; empty state "No deadlines in the next 30 days.";
  each row shows the title and `Today` / `Tomorrow` / `in n days`, red when `d <= 7`.

**The filter does not exclude completed events** — `cal-page:271–275` and `:277–280` both check
`!e.completed`, and this one does not. A deadline a person has ticked off still appears on the dashboard as
upcoming. Part D8.

`dash` reads nothing else date-shaped: `document_index_v` (`:81–85`) for the readings and the four stat
boxes, and `checklists` for two of them.

### B9. Account delete and export

**`app/api/account/route.ts` DELETE.** Two lists, both read by the gate in B9's check below:
- `COMPANY_SCOPED_TABLES` names **`handbook_dates` (:217)** and **`calendar_events` (:220)**, children first,
  `profiles` last.
- `DELETED_BY_CASCADE_OR_PARENT` names **`document_deadlines` (:240)** among the five document-scan tables
  (`:230–244`, with the reason: `company_id` → companies ON DELETE CASCADE, `confdeltype = 'c'` on all five,
  read from `pg_constraint` on 25 Sep) and **`audit_findings` (:260)** among the three audit tables
  (`:252–259`: taken twice over, since `(company_id, run_id)` → audit_runs also cascades).

So **all four date tables are accounted for by the deletion path**, two by name and two by a stated cascade.

**`app/api/account/export/route.ts` covers two of the four.**
- **`calendar_events`** — `byCompany('calendar_events')` at `:91`, in the payload at `:191`, counted at `:216`.
- **`handbook_dates`** — `:103`, `:202`, `:227`.
- **`document_deadlines` — absent.** It appears nowhere in the file.
- **`audit_findings` (and `audit_runs`, `audit_sections`) — absent.**

Computed rather than eyeballed: of the 42 tables the two deletion lists account for, 17 are exported by
`byCompany`, and `checklist_items`, `obligation_evidence` and `profiles` are exported through a parent. The
rest — including `document_deadlines`, the three audit tables, `document_scans`, `document_gaps`,
`document_conditions`, `document_corrections`, `topics` and `turns` — are not in the payload.
`docs/HANDOFF-FROM-HR.md` §8 carries one of these as an open defect ("Account export leaves out
conversations"); **the dates a document sets and the dates an audit found are the same class and are not yet
recorded anywhere.** Part D9.

**The check that enforces it — `scripts/check-schema-contracts.js`.**
- `:25–39` the known blind spot, stated in the script: a `.from(variable)` call cannot be attributed, there
  are **two** such sites, and *"Check 2 below covers the second of those specifically, because it is the
  deletion path."* The export is *"covered only by the fact that both use the same `company_id` filter."*
- `:189–231` **Check 2**: it parses `COMPANY_SCOPED_TABLES` and `DELETED_BY_CASCADE_OR_PARENT` out of
  `app/api/account/route.ts` with a regex (`:202–205`), lists every relation in `lib/database.types.ts`
  carrying `company_id`, skips views, and fails if a table is in neither list — or is listed and has no
  `company_id`.
- **So there is no check on the export at all.** The run in Part A printed its own blind spot:

```
2 dynamic .from(variable) call site(s), which cannot be checked here:
  app/api/account/export/route.ts: db.from(table)
  app/api/account/route.ts: supabaseAdmin.from(table)
```

### B10. Tests and `check:live` probes

**Unit tests (63 files in `tests/unit/`).** Of these, **one** tests date logic:

| File | Lines | What it covers |
|---|---|---|
| `tests/unit/significantDate.test.ts` | 106 | `chooseSignificantDate`, eleven tests: permit with a named expiry, permit with none, no dated deadline at all, **"THE CASE THIS EXISTS FOR: a program takes its own revision date, never a deadline"** (:45), policy, record, supplier document, two null cases (:78–79), and the two the golden fixtures caught — *"a deadline that MENTIONS the expiry does not beat the one that is it"* (:84) and case 03's expiry (:100) |
| `tests/unit/documentScan.test.ts` | 71, 192 | asserts `deadlines` is `[]` on two shapes |
| `tests/unit/extractJsonText.test.ts` | 50, 66 | `deadlines` as a key in two expected JSON shapes |
| `tests/unit/hrPolish.test.ts` | 17 | the negative: `assert.ok(!page.includes(".from('calendar_events')"), 'nothing reads the calendar for the Dates tab')` |
| `tests/unit/retention.test.ts` | 52 | "twelve calendar months" — the word "calendar", not this feature |

**There is no test of:** `cal-route` (any method), `cal-page`, `handleImport`, `handleAddToCalendar`,
`toggleComplete`, `?add=`/`?on=`, `deadline_to_calendar`, `/api/extract-dates`, `EXTRACT_PROMPT`,
`auditRun`'s date reshaping (`reshaped_to_dates` and `dropped_undated` appear in **no** test file), the
dashboard's 30-day filter, or `document_index_v`'s date derivation.

**`check:live` probes (`scripts/check-live.js`).**

| Table | Probed? |
|---|---|
| `handbook_dates` | **Yes, thoroughly.** `:222–223` in `HR_TABLES`; anon refused read and insert (`:234–238`); authenticated can read (`:240–243`) and **update** (`:269–271`); refused INSERT (`:273–275`) and DELETE (`:276–277`); **gone with its handbook** (`:298–299`) |
| `document_deadlines` | **Seeded, never probed.** `:1059–1062` writes one row as the service role so the audit flows have a permit to read. No grant, policy or anon check |
| `audit_findings` | **Partly.** `:146–152` a `reads_only` case: authenticated can read, is refused INSERT, anon refused. No date-specific probe, and the table is empty on staging |
| `calendar_events` | **Not at all.** The string `calendar_events` appears **0 times** in `scripts/check-live.js` |

That last row is the gap worth naming: `calendar_events` is the one table here a signed-in person may
INSERT, UPDATE and DELETE, and the one with a nullable `company_id`, and nothing checks that anon is refused
it, that a cross-tenant insert is refused, or that its four policies behave. `npm run check` cannot see any
of that — none of its tests makes an authenticated request (`HOW-WE-BUILD.md` §3a).

---

## PART C — the plumbing the calendar will copy

### C1. HR's answer path, end to end

**`app/api/hr/answer/route.ts` (280 lines), POST, streamed NDJSON.** `export const maxDuration = 800` (`:22`).

| Step | Lines | What | HR-specific or generic |
|---|---|---|---|
| `await connection()` | 28 | before anything, so the route is dynamic | **generic** |
| `requireCompany` | 30–32 | `companyId` and `db` (the caller's own client) | **generic** |
| body | 34–38 | `question`, `topicId`, `history`; no question → 400 | **generic** |
| the topic guard | 42–46 | a continued topic must be this company's, **`section === 'hr'`**, and `status === 'open'`; 404 otherwise so ids cannot be probed, 409 if closed | **generic shape, HR's literal** |
| the handbooks | 49–50 | `loadHandbooksForAnswer(db, companyId)`; a refusal returns `{ outcome: 'refused', message }` with **no model call and nothing saved** | **HR** |
| the company context | 52 | `buildCompanyContext(db, companyId, { parts: ['company', 'declared', 'confirmed'] })).block` | **generic** (C8) |
| topic + question saved first | 58–72 | create the topic with `section: 'hr'` (`:61`), `nextPosition`, `saveUserTurn`, `setTitleIfFirst`; a failure here logs and sets `topicId = null` — **the answer still runs** | **generic** |
| history | 74–96 | the client's, or `loadTurns` paired up skipping stopped turns; each earlier answer gets its sources appended by `appendHandbookSources` | **generic shape** |
| the wait | 106–150 | every 2s, one 3-minute limit (`WAIT_LIMIT_MS`), two kinds: a handbook whose text is not saved (starts a reading through `startReadingNow`, `:121`) and a long handbook whose sections are not found | **HR** |
| the first stage | 157 | `send({ type: 'reading', handbooks: … })` — true before the call | **HR** |
| section selection | 159–176 | one `askAIJson` call per long handbook plus a code safety net; `chooseSections` decides | **HR** |
| the message | 192 | `hrAnswerMessage(companyBlock, sentHandbooks, question, fitted?.blocks)` | **HR** |
| the search limit | 194 | `searchLimit('AI_SEARCH_MAX_HR', null) ?? undefined` — unset means no limit | **generic helper** |
| the call | 195–196 | `askAIOpenStream(hrAnswerPrompt(), messages, { task: 'hr', maxTokens: 16000, signal: request.signal, ledger: { companyId, task: 'hr' }, maxSearches })` | **generic helper, HR's task** |
| **the checks, in code, at done** | 197–235 | `finishAnswer` — below | **HR's quote check, generic link check** |
| the grey lines | 216–232 | quotes dropped, links dropped, the long-handbook lines, a handbook that could not be read, and the day-1 line — appended **after** the answer, joined with `\n\n`; **the model's words are never changed** | **HR's words, generic pattern** |
| saved | 236–247 | `saveAssistantTurn(db, { …, checkRecord })` | **generic** |
| the counter | 249–250 | `bumpCounter(supabaseAdmin, companyId, 'questions_answered')` | **generic** |
| stop vs error | 251–259 | an aborted signal is **the person's Stop**, logged and not an error; a real error sends the workspace's own `FAILED_LINE` (`:25`) and never the provider's words | **generic** |
| `finally` | 265–270 | if not completed, `markTurnStopped(supabaseAdmin, userTurnId)` | **generic** |

**The prompt — `prompts/hr-answer.ts` (35 lines).**

```
export const HR_GIVEN_SENTENCE = "You are given the company's handbooks, section by section, and what is known about the company."
export const HR_OFFER_SENTENCE = 'Stay with the handbooks and the employment rules they touch. If you end with an offer, offer only what you can do here: explain a rule, compare a handbook section with it, or write suggested wording for the handbook.'

export function hrAnswerPrompt(): string {
  return `${buildSystemPrompt('research', null, { open: true })}\n\n${HR_GIVEN_SENTENCE}\n\n${HR_OFFER_SENTENCE}`
}
```

`:25–27`. It is a **function, not a constant**, because the switches are read when the prompt is built
(`:10–11`). `hrAnswerMessage` (`:30–35`) assembles the user message: **"About the company:" … "The company's
handbooks (current versions):" … optional checks … "Question: …"** — company, handbooks, question, in that
order.

**How `buildSystemPrompt` is reused — `prompts/checklist.ts:326–363`.** Called as
`buildSystemPrompt('research', null, { open: true })`, it takes the `options.open` branch (`:333`), reads
three switches through `pipelineSwitch` (`:337–339`), and builds `head` as `OPEN_ROLE` plus whichever of
`PROVENANCE_SENTENCE`, `PREFER_GOV_SOURCES` and `RESEARCH_SPECIALIST_BLOCK` are on, in that fixed order
(`:349–354`); `mode === 'research'` returns `head` (`:362`). **So HR's answers inherit every change to the
workspace's research prompt** — `prompts/hr-answer.ts:10` says *"Imported, never copied, so the two cannot
drift"*, and `docs/HANDOFF-FROM-HR.md` §6 lists it first among the shared files. `RESEARCH_SPECIALIST_BLOCK`
(`prompts/checklist.ts:281–285`) is the paragraph ending *"End with one specific offer of what you could do
next"* that produced the production finding in `HANDOFF-FROM-HR.md` §2, and `HR_OFFER_SENTENCE` is the fix.

**The checks after the call — `lib/hrAnswer.ts:473–523`, `finishAnswer`.** The pattern a calendar section
would copy whole:
- `checkPlainQuotes` first (`:481`, defined `:441`), then one pass over `MARKER` (`:422`), which matches both
  a web marker `[3]` and a handbook marker `[H7: "…"]`.
- **A web link survives only if `findReturned(s.url, searched)` finds it** among the pages *this answer's*
  search actually returned (`:496`); otherwise it is removed and `droppedLinks++`. Surviving links are
  renumbered from 1 and labelled by `labelFor(s.url)` → `official` or `other`. Both helpers are
  `lib/howTo.ts`'s.
- **A handbook quote survives only if `checkQuote` (`:374`) finds it** in a block the answer was given;
  otherwise the marker is removed and `droppedQuotes++` (`:504`). A survivor is rewritten **in place** as
  `“<quote>”[n]` (`:519`) with a card carrying the handbook name, section title and page range.
- A **plain** quote of six words or more (`QUOTE_MIN_WORDS`, `:32`) found nowhere is **kept and marked**, not
  removed (`:521`'s note).
- `replaceBlockIds` (`:532–543`) replaces any leftover internal `H12` with that block's title, so internal
  ids never reach a person.

**`check_record` is written by `saveAssistantTurn`** — `lib/conversation.ts:97–112`, `:109`:
`...(args.checkRecord ? { check_record: args.checkRecord } : {})`. The column is `turns.check_record`,
migration 069. Its contents are built by `checkRecord()`, `lib/hrAnswer.ts:566–595`: `version: 2`, the
handbooks given, the section selection with *how each section was chosen*, `waited_seconds`, `budget_tokens`,
every URL searched, the cited-passage count, each card's origin (`marker` or `plain`), and what was dropped
and what was marked. **This is the generic idea worth copying:** an answer that can be audited after the fact
without re-running it.

**Generic vs HR, summarised.** Generic: `requireCompany`, the topic/turn save-before-answer, `loadTurns`,
`buildCompanyContext`, `askAIOpenStream` with a ledger task, `searchLimit`, the link check
(`findReturned`/`labelFor`), the grey-lines-after-the-answer pattern, the check record, `bumpCounter`,
abort-is-not-an-error, `markTurnStopped`. HR-specific: everything about handbooks — loading, the budget, the
wait, section selection, `checkQuote` against handbook blocks, `lib/hrAnswerWords.ts`'s sentences, and the
`section = 'hr'` literal.

### C2. HR's page — `app/hr/HrWorkspace.tsx` (1,154 lines)

`app/hr/page.tsx` renders it; the whole page is one client component.

| Piece | Lines |
|---|---|
| `type Tab = 'ask' \| 'conversations' \| 'handbooks' \| 'dates'` | 53 |
| `AttachControl` | 110–123 |
| `HrAnswerView` (suggested wording as a draft; the grey lines after the answer) | 125–141 |
| state — tab, box, company, topics, handbooks, sites | 145–153 |
| **`const [dates] = useState<DateRow[]>([])`** — no setter; never populated | **155** |
| upload/pending-file state | 157–165 |
| the handbook drawer, deleting, reading | 162–178 |
| `rowChecks`, `drawerCheck`, `checkPressed`, `checkNotice` | 219–258 |
| the one load (`Promise.all` of topics, sites, checks) | 282–298 |
| ask state and `ask()` (the NDJSON reader, `tap`) | 299–375 |
| conversation drawer, `openConversation`, delete | 376–416 |
| `summarise()` and the summary wait | 417–452 |
| `convReport` (the report drawer's data) | 453–483 |
| `addHandbook()` from the Ask tab (Step 11b) | 484–577 |
| `rehome` ("Choose where it applies") | 578–623 |
| the one file picker for the page | 624–627 |
| the 900 column | 628 |
| the title and lede | 630–635 |
| **`<Tabs>` — three entries only: `ask`, `conversations`, `handbooks`** | 637–649 |
| the notice banner | 651–657 |
| **ASK** — the box, the examples overlay, the docked composer, the action row, "Add a handbook" in the attach slot, the counts line | 659–821 |
| **CONVERSATIONS** — `ConversationList`, rows open the summary drawer | 823–841 |
| **HANDBOOKS** — the versions list | 843–900 |
| **DATES** — rendered, unreachable | 902–919 |
| the conversation drawer | 923–970 |
| the conversation delete sheet ("Download the summary" first) | 972–987 |
| the handbook drawer (shared 720 drawer) | 989–1090 |
| "Choose where it applies" sheet | 1091–1110 |
| the which-site sheet | 1111–1131 |
| the handbook delete sheet | 1132–1154 |

**How the Dates tab is hidden: by omission from the `tabs` array, nothing else.** The `Tab` union still
contains `'dates'` (`:53`), the render block still exists (`:902–919`) and would draw rows if `dates` were
ever non-empty, and the empty state reads *"No dates yet — When a handbook check finds a date, you can add
it to your calendar. It shows here."* (`:906`). The data is simply never loaded: `:155` destructures only the
getter. `tests/unit/hrPolish.test.ts:14–18` pins both halves — the three tab keys in order, and that the page
contains no `.from('calendar_events')`.

**The examples** are `HR_EXAMPLE_QUESTIONS` in `config/examples.ts:48–61`, shown as a grey overlay inside the
empty box, each prefixed "e.g.", gone the moment anything is typed, **not clickable and not a prompt**
(`config/examples.ts:8–19`). The file is explicitly the owner's to edit.

### C3. Conversations as topics

- **`topics.section`** — `066:245–247`:
  `alter table public.topics add column if not exists section text not null default 'workspace';`
  then `topics_section_is_known check (section in ('workspace', 'hr'))`. Confirmed in the live catalog:
  `CHECK ((section = ANY (ARRAY['workspace'::text, 'hr'::text])))`.
  **A calendar section with its own conversations needs a migration to widen this CHECK.** 066:596–598
  verifies that `'documents'` is refused, so there is a test shape to copy.
  Index: `idx_topics_company_section_last_turn (company_id, section, last_turn_at desc)` — `066:249`.
- **`topic_list_v`** — `066:254–` reissues the 065 view with `section` appended at the end, as
  `create or replace view` requires. `security_invoker = true`; `anon` cannot select it.
- **Each section's list filters by section in exactly one place** — `lib/topicList.ts:55–63`:

```
export async function readTopicList(db: SupabaseClient, section: TopicSection): Promise<TopicRow[]> {
  const { data } = await db.from('topic_list_v').select(TOPIC_LIST_COLUMNS)
    .eq('section', section)
    .order('last_turn_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }).limit(LIST_CAP)
```

  `grep -rn "eq('section'" app lib` returns **this line and nothing else**. Callers:
  `app/compliance/page.tsx:327` passes `'workspace'`; `app/hr/HrWorkspace.tsx:284, 370, 411, 427, 437` pass
  `'hr'`. `TopicSection` is `'workspace' | 'hr'` (`:49`) — a third section is a one-word change here plus the
  migration. `TOPIC_LIST_COLUMNS` (`:34–36`) and `toTopicRow` (`:38–46`) are shared unchanged.
- **`lib/conversation.ts` (197 lines)**: `touchTopic` (:53), `nextPosition` (:69), `saveUserTurn` (:78),
  `saveAssistantTurn` (:97, with `check_record` at :109), `markTurnStopped` (:133, admin client),
  `titleFromQuestion` (:145), `setTitleIfFirst` (:151), `loadTurns` (:160), `bumpCounter` (:184). **None of
  it knows about sections** — the section lives on the topic row only.
- **`lib/topicClaim.ts` (164 lines)**: `CLAIM_LOCK_MS` = 10 minutes (:26), `CLAIM_WORK_MS` = 9 minutes (:32),
  `ClaimKind = 'summary' | 'checklist'` (:34), `CLAIM_COLUMN` mapping to
  `summary_started_at` / `checklist_started_at` (:36–40), `CLAIM_WORDS` (:42), `isClaimHeld` (:48),
  `claimFilter` (:58), `guardSummaryWrite` (:72), `claimTopic` (:88), `releaseTopic` (:105),
  `ClaimTimeout` / `withinClaimTime` (:114–131), and the nightly rule: `IDLE_HOURS = 6` (:133),
  `nightlyCandidates` (:148).
- **The summarise route — `app/api/hr/topics/[id]/summarise/route.ts` (67 lines)**, the claim-reply-`after()`
  shape `CLAUDE.md` §3.11 names: `requireCompany` (:24), the topic must be `section === 'hr'` else 404
  (:32–34), no turns → 409 (:37–39), `claimTopic(db, id, 'summary')` → 409 `{ status: 'writing' }` if held
  (:41–44), **`after()`** with `withinClaimTime(summariseTopic(…), 'summary')` (:46–51), the claim released in
  `finally` (:58–60), and **202 `{ status: 'started' }` returned at once** (:62).
- **`lib/summaryReport.ts` (493 lines), `summariseTopic` at `:422`, `kind?: 'workspace' | 'hr'` at `:430`,
  `const hr = args.kind === 'hr'` at `:443`.** One writer for both sections. Its other exports are all
  section-blind: `sourceKey` (:88), `gatherSources` (:96), `numberedTranscript` (:125),
  `cleanSourceNumbers` (:165), `normaliseForMatch` (:182), `quoteKey` (:188), `checkCitations` (:210),
  `trimTitle` (:238), `checkReport` (:259), `renderPlainText` (:364), `proposalsToInsert` (:394).
  `:78` names what the `kind` flag changes: `keepFields` keeps the stored source's other fields
  (HR: kind, quote, handbook, section, pages).

### C4. The night jobs

**`vercel.json` (10 lines), all UTC:**

```
{ "path": "/api/jobs/summarise",        "schedule": "0 10 * * *"  }
{ "path": "/api/jobs/delete",           "schedule": "30 10 * * *" }
{ "path": "/api/jobs/scan-documents",   "schedule": "*/5 * * * *" }
{ "path": "/api/jobs/audit-sections",   "schedule": "*/5 * * * *" }
{ "path": "/api/jobs/handbook-queue",   "schedule": "0 10 * * *"  }
{ "path": "/api/jobs/handbook-checks",  "schedule": "*/5 * * * *" }
```

**`lib/cronSecret.ts` (51 lines)** — the rule with no Next.js in it, so it can be unit-tested:
`cronVerdict(method, header, secret)` at `:39–51`. **GET** takes `Authorization: Bearer <CRON_SECRET>`
(Vercel Cron); **POST** takes `x-cron-secret` (a person by hand). Each door takes **only its own header**
(`:14–15`). `sameSecret` (`:33–37`) compares lengths first then `timingSafeEqual`. **Unset refuses both**
(`:43`), and `:17–19` says why the tempting `if (secret && given !== secret)` is wrong.

**`lib/jobAuth.ts` (85 lines)** — `requireCronSecret` (`:31–46`): **every refusal is 404 and stays 404**
(`:16–20`), loud in the log and opaque to the caller. And `startJobRun` (`:66–84`): the row is opened
**before** the work, so a crash leaves `finished_at` null, which is a visible failure rather than an absence
indistinguishable from "cron never fired" (`:54–57`). Its `job` parameter is a literal union of the six
allowed names.

**`lib/jobRun.ts` (70 lines)** — the **lazy** variant for the five-minute sweeps. `:5–7`: opening a row every
five minutes wrote 576 rows a day saying "nothing to do". `lazyJobRun(admin, job)` (`:44–69`) opens once on
first work (`open()`, idempotent through a memoised promise at `:51`) and `finish()` follows
`recordDecision(opened, errorCount)` (`:32–35`): **update** if opened, **insert** a whole row if it never
opened but errored, **nothing** otherwise. `SweepJob` is `'scan_documents' | 'audit_sections' | 'handbook_checks'`
(`:27`). `:61` and `:77–80`: `ok` is about whether the **run** completed, not whether every item succeeded.

**The `job_runs` CHECK, live catalog:**

```
job_runs_job_check  CHECK ((job = ANY (ARRAY['summarise','delete','account_delete','scan_documents','audit_sections','handbook_checks'])))
```

**A calendar job needs a migration to add its name here, and its name added to both unions** —
`lib/jobAuth.ts:66` and `lib/jobRun.ts:27`.

**One daily job as the shape to copy — `app/api/jobs/handbook-queue/route.ts` (41 lines)**, the smallest of
the six and the clearest:

```
export const maxDuration = 800
export async function GET(request)  { return POST(request) }          // :18–20
export async function POST(request) {
  const auth = requireCronSecret(request); if (!auth.ok) return auth.response   // :23–24
  const run = await startJobRun(supabaseAdmin, 'handbook_checks')               // :26
  ... try { result = await queueDueChecks(supabaseAdmin) } catch { errors.push(…) }   // :29–33
  await run.finish({ job: 'queue', queued: …, skipped_open: …, not_due: … }, errors)  // :34
  if (result.queued.length) after(async () => { await sweepChecks(supabaseAdmin) })   // :35–39
  return NextResponse.json({ job: 'handbook_queue', run: run.id, …, errors })         // :40
}
```

Note four things a calendar job would copy: **GET delegates to POST** so one body serves cron and hand;
**the secret is checked before anything**; **`counts.job` says which job wrote the row** when two jobs share
a name (`:9–10`); and **the heavy work is kicked in `after()`**, after the response.

### C5. The three emails

| | `lib/auditNotify.ts` (198) | `lib/handbookCheckNotify.ts` (111) | `lib/documentBatch.ts` (225) |
|---|---|---|---|
| entry | `notifyRun(db, runId, opts)` | `notifyCheck(db, checkId, opts)` :43 | the batch sweep's sender |
| guard row | `audit_runs.notified_at` :63–66 | `handbook_checks.notified_at` (071) :45–50 | `document_batches.notified_at` |
| `dryRun` | :57–60, :164 | :87 | yes |
| `NEXT_PUBLIC_APP_URL` | :89, refuses at :170–172 | :64, refuses at :91–93 | :167, refuses at :200–203 |
| `NOTIFY_TEST_TO` | :90 | :65 | :168 |
| `RESEND_API_KEY` | :177–180 | :96 | :206–209 |
| sender | `new Resend(key)` :184, `from: 'CompliBoard <onboarding@resend.dev>'` :186 | :102–103 | :213–215 |
| stamps on success only | :192–193, `.is('notified_at', null)` | yes | yes |

**The shared plumbing is a convention, not a module.** All three refuse without `NEXT_PUBLIC_APP_URL`
(because a link that would not work is worse than no email), all three honour `NOTIFY_TEST_TO` and say at the
top of the body where the mail was really addressed, all three stamp `notified_at` **only after a send that
actually succeeded**, and all three accept `dryRun` so a manual test can see the words without emptying
`notified_at`.

**Confirmed: there is no shared template and no shared sender.** `grep -rn "onboarding@resend.dev\|new Resend("`
over `lib/` and `app/` returns **four** independent copies — the three above plus
`app/api/feedback/route.ts:4, 11`. `ls lib/ | grep -i "mail\|notify\|resend"` returns only `auditNotify.ts`
and `handbookCheckNotify.ts`. `handbookCheckNotify.ts:10–11` says the duplication is deliberate
(*"Everything else is notifyRun's shape, on purpose"*), and `HR_PAGE_PATH = '/hr'` is its own constant.
A fourth email would be a fourth copy unless somebody factors the sender out first.

### C6. The shared UI and print

| File | Lines | Exports |
|---|---|---|
| `components/Drawer.tsx` | 96 | `Drawer`, `printDrawer`, `printDate` (`:96`) |
| `components/Sheet.tsx` | 28 | `Sheet({ title, lede, children, onClose })` (`:10`) |
| `components/Tabs.tsx` | 31 | `Tabs<K extends string>({ tabs, active, onSelect, right })` (`:13`) |
| `components/Empty.tsx` | 14 | `Empty({ title, note })` (`:7`) |
| `components/buttonStyles.ts` | 25 | `PRIMARY` (:14), `SECONDARY_LARGE` (:18), `OUTLINE` (:22), `TEXT_ACTION` (:25) |
| `components/AnswerBody.tsx` | 206 | `AnswerSource` (:34), `GREY_NOTE_HREF` (:121), `AnswerBody({ text, sources })` (:123), `SourceList({ sources })` (:166) |
| `components/ReportView.tsx` | 176 | `SourceShape` (:42), `ReportLike` (:50), `WEB_SOURCE` (:60), `ReportWords` (:78), `ReportView` (:87) |
| `components/ConversationList.tsx` | 84 | `ConversationList({ topics, running, onOpen })` (:17), `ConversationRow` (:54) |
| `lib/printFrame.ts` | 86 | `cssString` (:8), `printFrameCss({ company, type })` (:39), `printDate` (:57), `printWithFrame(frame, bodyClass?)` (:70) |

`components/ReportView.tsx:87` is generic over the source type (`S extends { n: number }`) with `words` and
`sourceShape` injected — which is how one report view serves the workspace and HR with different nouns
(`WEB_SOURCE` at `:60` is the workspace's shape). **`cal-page` uses none of these** (B5).

### C7. `lib/ai.ts` — tiers, the ledger, and what a `calendar` task would touch

**A task tier is named in two places.**
1. `export type AITask` — `lib/ai.ts:27`, today:
   `'judgement' | 'critique' | 'prose' | 'default' | 'substeps' | 'summary' | 'document_scan' | 'document_draft' | 'audit' | 'howto' | 'hr' | 'hr_check'`.
2. `const TASK_MODELS: Record<AITask, () => string>` — `:96–148`. Each entry is **a function, not a value**,
   so the variable is read at the decision point. `modelForTask(task = 'default')` at `:150–152` is the one
   resolver, exported *"for the golden runner, which must call the same model the route would"*.

The pattern for a new tier is `hr`/`hr_check` at `:144–145`:
`hr: () => process.env.AI_MODEL_HR || TASK_MODELS.prose()` — **its own variable, falling back to an existing
tier rather than to `default`**, because `default` is the tier `:117–121` records as how the most expensive
call in the product ended up on a model nobody had chosen.

**A ledger task is declared in `lib/costLedger.ts`**, also in two places: `export type LedgerTask` at
`:22–26` and `export const LEDGER_TASKS` at `:27–41`. `:21` states the contract: *"The tasks migration 038's
CHECK constraint allows. Kept in step with it by hand and by test."*

**The `ai_calls` CHECK, live catalog:**

```
ai_calls_task_check  CHECK ((task = ANY (ARRAY['research','checklist','substeps','convert','summarise',
  'gate','critique','audit','document_review','document_scan','document_draft','howto','other','hr','hr_check'])))
```

**So adding `AI_MODEL_CALENDAR` and a `'calendar'` ledger task touches exactly five things:**

| # | File / object | Change |
|---|---|---|
| 1 | `lib/ai.ts:27` | add `'calendar'` to the `AITask` union |
| 2 | `lib/ai.ts:96–148` | add `calendar: () => process.env.AI_MODEL_CALENDAR \|\| TASK_MODELS.<tier>()` |
| 3 | `lib/costLedger.ts:22–26` and `:27–41` | add `'calendar'` to the type and the array |
| 4 | a new migration | drop and recreate `ai_calls_task_check` with `'calendar'` added, as 050, 064 and 066 each did |
| 5 | `tests/unit/costLedger.test.ts:113–117` | the hand-kept `inMigration` list, which `assert.deepEqual`s against `LEDGER_TASKS`. `:104–112` records that this test has caught exactly this drift twice (`document_scan`, then `document_draft`) |

**The Haiku guard needs no change.** `scripts/haiku-names.mjs:16–18` derives `modelVars()` by regexing
`process.env.(AI_MODEL\w*)` out of `lib/ai.ts` itself, and `:20–24` derives `aiTasks()` from the `AITask`
line — `:4–5` says so: *"so a tier added later is covered without anybody remembering to add it here."*
`scripts/haiku.mjs:37–38` then sets every one of them to `HAIKU` and `:45–46` refuses to start the command if
`haiku-check.mjs` finds a tier that is not Haiku.

**And note what `/api/extract-dates` does today:** it writes `task: 'other'`
(`app/api/extract-dates/route.ts:69`). `:62–66` records why that was an improvement (it used to write
`companyId: null`) and names the remaining problem: *"the `other` task stops being the bucket where
unattributed spend goes to be forgotten."* A calendar ledger task would move that call out of `other`.

**One related helper:** `searchLimit` — `lib/ai.ts:249–251`, overloaded so `AI_SEARCH_MAX_HR` may be `null`
(unset means no limit) while `AI_SEARCH_MAX_HOWTO` and `AI_SEARCH_MAX_COMPLETE` take a numeric fallback.
`DEV_MAX_SEARCHES` caps `web_search.max_uses` whenever `NODE_ENV` is not production (`CLAUDE.md` §3.4a).

### C8. `lib/companyContext.ts` (502 lines)

**`CompanyContextPart`** — `:63–67`: `'company' | 'declared' | 'confirmed' | 'labels' | 'keys' | 'document'`,
with `ALL_PARTS` beside it. `buildCompanyContext(db, companyId, opts)` at `:223` assembles only the requested
parts (`:228`) and returns `{ parts, block, sha256 }` (`:398–400`) — **`sha256` is a fingerprint of the
rendered block, so it is a fingerprint of what *this caller* asked for**, which is the point of the `parts`
argument (`:408–410`). `renderCompanyContext` at `:411` does the rendering. `siteWhere` at `:198` formats a
site's address.

`:14–17` states the rule: *"No prompt gains anything it does not read today. Each caller asks for the PARTS
it already..."*

**Which prompts read it, and with which parts:**

| Caller | Line | Parts |
|---|---|---|
| `app/api/chat/route.ts` | 724–725 | `company`, `declared` |
| `app/api/company-information/route.ts` | 51–52 | `company`, `declared`, `confirmed`, `labels` |
| `app/api/hr/answer/route.ts` | 52 | `company`, `declared`, `confirmed` |
| `app/api/document-draft/route.ts` | 74 | `company` |
| `lib/determinationGate.ts` | 434 | `company`, `declared` |
| `lib/handbookCheck.ts` | 130, 294 | `company`, `declared`, `confirmed` |
| `lib/audit.ts` | 131–132 | `company`, `confirmed`, `labels`, `keys` |
| `lib/documentScan.ts` | 443 | `SCAN_CONTEXT_PARTS` = `['company','confirmed','labels','keys','document']` (`documentScan.ts:398`) |
| `scripts/scan-document.js` | 122 | the same constant, imported |
| `scripts/run-golden-docs.js` | 610 | the same constant, imported |

`documentScan.ts:384–397` explains why the scan's parts are a **named exported constant** rather than written
out at each site: two scripts report the block that fed a prompt, and if either wrote its own list the report
would drift from the prompt and nobody would notice. **A calendar prompt that needs a context block should
do the same** — name its parts once, export them, and have any script import them.

---

## PART D — the disagreements

Where a document and the code disagree, **the code wins**. Each row says what settles it.

### D1. `docs/SCHEMA.md` says `lib/handbookCheck` writes `handbook_dates`. It does not. — the brief's candidate, CONFIRMED

`docs/SCHEMA.md:1902`: **"Read or written by: `lib handbookCheck`, `script check-live`"**.

`lib/handbookCheck.ts` contains **no reference to `handbook_dates` at all**; its `.from()` calls are
`handbooks` (:119), `handbook_sections` (:125), `handbook_checks` (:131), `handbook_check_sections` (:142),
`entities` (:302), `ai_calls` (:363). Run against `schema-doc.js`'s own matcher
(`scripts/schema-doc.js:197–201`), `handbook_dates` resolves to **`scripts/check-live.js`** and nothing else.
**Correct line: "Read or written by: `script check-live`."** (B4.)

### D2. `docs/TODO.md` says `/api/extract-dates` writes `calendar_events`. It writes nothing. — the brief's candidate, CONFIRMED

`docs/TODO.md:2827–2829`: *"Today `/api/extract-dates` sends a document to the model with a prompt asking it
to find … and **writes what comes back into `calendar_events`**."*

The route returns JSON and touches no table: `app/api/extract-dates/route.ts:72` is
`return NextResponse.json(result)`, and the file holds no `.from(`, no `supabaseAdmin` and no `authed.db`
query. The write is the **person's**: `cal-page:174–176` puts the dates in `pendingDates`, the sheet at
`:551–596` lets them choose, and `handleAddToCalendar` (`:197–229`) POSTs each chosen date to
`/api/calendar`. **`docs/TODO.md` contradicts itself on the same subject** — `:983` reads *"No database at
all (4): `chat`, `extract-dates`, `scan-website`, `feedback`"*, which is correct.

### D3. `docs/SCHEMA.md` describes the `calendar_events` → `handbooks` key as if it nulls `company_id`. — the brief's candidate, CONFIRMED

`docs/SCHEMA.md`, the `calendar_events` section, "Points at":

```
- `company_id` → `handbooks` — ON DELETE SET NULL
- `handbook_id` → `handbooks` — ON DELETE SET NULL
```

The live constraint is **one** composite key, not two:

```
calendar_events_handbook_in_same_company
  FOREIGN KEY (company_id, handbook_id) REFERENCES handbooks(company_id, id) ON DELETE SET NULL (handbook_id)
```

`SET NULL (handbook_id)` nulls **only `handbook_id`**. `company_id` is never touched — and could not be,
since a null-company calendar row is exactly what the composite key exists to prevent. Migration
066:580–582 asserts both halves after a handbook delete, and 066:585–588 reads `confdeltype = 'n'` from
`pg_constraint`.

**This is a generated-document artefact, not a typo, and it affects three more places.** `scripts/schema-doc.js`
decomposes a composite FK into one row per column and attaches the whole constraint's ON DELETE clause to
each, so the same misreading appears wherever a composite key exists:
- `docs/SCHEMA.md:1868` — **"`handbook_dates.company_id` — ON DELETE SET NULL"**, under `handbook_checks`.
  `handbook_dates.company_id` is `NOT NULL`; the real clause is `SET NULL (check_id)`.
- `docs/SCHEMA.md`, `handbook_dates`'s own "Points at" — `company_id` listed **three times** with three
  different ON DELETE clauses (`handbooks` CASCADE, `companies` CASCADE, `handbook_checks` SET NULL).

The fix belongs in `scripts/schema-doc.js`, not in the Markdown, and it is a Documents/Audits/HR-wide
correction rather than a calendar one.

### D4. `docs/SCHEMA.md` names `screen hr` as a reader of `calendar_events`. Nothing under `app/hr/` reads it.

`docs/SCHEMA.md`, `calendar_events`: **"Read or written by: `route calendar`, `route document-actions`,
`screen hr`"**.

`grep -rn "calendar_events" app/hr/` returns **nothing**. The only mention of the word "calendar" under
`app/hr/` is the Dates tab's empty-state sentence, `app/hr/HrWorkspace.tsx:906`. Reproducing
`schema-doc.js`'s matcher over `app/`, `lib/` and `scripts/` gives
`calendar_events -> ['app/api/calendar/route.ts', 'app/api/document-actions/route.ts']`.

**The attribution is stale.** `schema-doc.js` runs as part of `db:migrate` and `db:reset`; the last migration
was 072, when old HR lived at `app/hr/new/HrWorkspace.tsx` and the parked structured check read the calendar.
HR then moved to `app/hr/HrWorkspace.tsx` and lost that read, and `tests/unit/hrPolish.test.ts:17` now
asserts it is gone — but `docs/SCHEMA.md` has not been regenerated since. **Correct line: "`route calendar`,
`route document-actions`."**

**And `schema-doc.js` does not walk `components/`** (`:197` walks `app`, `lib`, `scripts` only), so a table
read only from a component would show as read by nothing. None of the four date tables is in that position
today.

### D5. `docs/SCHEMA.md`'s row counts for all three date tables are stale.

| Table | `docs/SCHEMA.md` | Live staging (service role, 15 Oct) |
|---|---|---|
| `calendar_events` | **Rows: 2** | **0** |
| `document_deadlines` | **Rows: 35** | **37** |
| `handbook_dates` | **Rows: 10** | **0** |

Not a defect in itself — the counts are a snapshot taken by `scripts/schema-doc.js` at the last
`db:migrate`/`db:reset`, and staging was rebuilt from the 072 baseline on 14 October (HEAD's own commit).
It is recorded because **`docs/SCHEMA.md`'s row counts must not be cited as current**, and because
`handbook_dates: 10` would otherwise suggest something writes it (D1).

### D6. `doc-actions` uses `supabaseAdmin` for a statement its own header does not name, and which `authenticated` is granted.

`app/api/document-actions/route.ts:14–22` states the split and lists the service-role statements by name:
*"`supabaseAdmin` — for `document_corrections`, `document_gaps.status` and `fact_proposals.status`"*, with
the reason (those grants are deliberately withheld from `authenticated`).

`:148–150` then does:

```
const { error } = await supabaseAdmin.from('document_deadlines')
  .update({ calendar_event_id: event.id }).eq('id', deadlineId)
```

**`document_deadlines` is not on that list, and `authenticated` holds UPDATE on it.** Read with
`has_table_privilege`: `authenticated` → SELECT ✓, UPDATE ✓. Migration 040:243 grants it, and 040:240–241
gives the reason in as many words: *"A person may correct a gap … and **confirm a deadline**, so those two
take UPDATE."* The policy `document_deadlines_update_own` (040:256–258) carries both `USING` and
`WITH CHECK`.

**Why it matters, stated precisely.** This is **not** a tenancy hole: `:130–135` already proved the deadline
belongs to the caller's document through `authed.db`, so the row is the right one. What it costs is the
second layer — `CLAUDE.md` §3.6's *"Tenancy enforced in two independent layers, so a route that forgets a
check now fails closed"*. Written through `db`, a future refactor that loses the ownership check would be
caught by RLS; written through `supabaseAdmin`, it would not. And §3.6's rule is explicit: *"A route may
hold it for a named statement; it may not hold it out of habit"* — this statement is not named.

**HYPOTHESIS as to cause**, offered as one because nothing in the repository settles it: the line was
written beside the three statements above and inherited their client. **What would settle it:**
`git log -L 148,150:app/api/document-actions/route.ts`. Not run — out of this job's scope.

### D7. `cal-page`'s "mark done" sends no token, so the PATCH is a 401 the page does not read.

**The three lines, `app/calendar/page.tsx:231–239`:**

```
async function toggleComplete(event: CalendarEvent) {
  const newCompleted = !event.completed
  setEvents(prev => prev.map(e => e.id === event.id ? { ...e, completed: newCompleted } : e))
  await fetch('/api/calendar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: event.id, completed: newCompleted }),
  })
}
```

**No `authHeaders()`.** It is the only fetch on this page without one — `:112`, `:131`, `:171`, `:205` and
`:244` all have it.

**`requireCompany` reads the header and nothing else** — `lib/auth.ts:71–82`:

```
const authHeader = request.headers.get('authorization') || ''
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
if (authError || !user) { return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } }
```

**There is no cookie fallback and no middleware.** `find . -maxdepth 2 -name middleware.ts` (excluding
`node_modules`) returns nothing, and `docs/TODO.md:1061–1062` says the same: *"no middleware, no
`vercel.json`, empty `next.config.ts`."* `PATCH /api/calendar` (`cal-route:97–101`) calls `requireCompany`
first, so an empty token is a 401 before any update.

**And the failure is invisible**, which is what makes it this project's named shape (`HOW-WE-BUILD.md` §3,
*"The failure is always something that looks like it worked"*): `:233` updates local state **before** the
fetch, `:234` does not `await`-and-check `res.ok`, and there is no `catch`. The tick appears, the strike-through
appears, and on the next page load the row is unticked again. `handleAddEvent` by contrast checks
`res.ok` at `:142`.

**Status: PLAUSIBLE, not CONFIRMED, and the gap is named.** The static chain is complete — no header, no
fallback, no middleware, a guard that 401s on an empty token — but **this was not executed against a running
server**, because this job is read-only and may not drive any port but 3999. **What would settle it in one
step:** sign in on a dev server, tick a deadline, reload, and read
`.next/dev/logs/next-development.log` (`HOW-WE-BUILD.md` §3b — a route's `console.error` does *not* reach the
`npm run dev` terminal on Next 16).

### D8. The dashboard counts completed deadlines as upcoming; the calendar page does not.

`app/dashboard/page.tsx:108–111` filters `events` by date range only. `app/calendar/page.tsx:271–275`
(`upcomingEvents`) and `:277–280` (`overdueEvents`) both add `&& !e.completed`.

So a deadline a person has ticked off still appears under **"Upcoming — next 30 days"** on the dashboard
(`:208`) and is counted in its emptiness test (`:210`), while the calendar's own "Due in 30 days" strip
(`:322–327`) excludes it. The field is available to the dashboard — `GET /api/calendar` is `select('*')`
(`cal-route:86`) — it is simply not read: `interface CalEvent` (`dash:16`) declares three fields and
`completed` is not one of them.

`npm run check` cannot see this: there is no test of either filter (B10).

### D9. Account export covers two of the four date tables; nothing checks that it should cover more.

`document_deadlines` and `audit_findings` appear nowhere in `app/api/account/export/route.ts`, while
`calendar_events` (`:91`) and `handbook_dates` (`:103`) do. **Check 2 in
`scripts/check-schema-contracts.js:189–231` guards only the deletion path**, and the script says so at
`:33–39`. So the gap is not a broken check; it is an unchecked surface, and it is the same class as the
already-recorded *"Account export leaves out conversations"* in `docs/HANDOFF-FROM-HR.md` §8.

Whether a customer's export should contain the dates a reading found is a **product decision**, not a
defect to fix silently. Flagged for the owner.

### D10. `/calendar`'s file picker excludes images that `/api/extract-dates` can read — `docs/TODO.md:2799`, still open.

`cal-page:342` is `accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.pptx,.ppt"`. `lib/documentContent.ts:76–77` maps
`jpg`, `jpeg`, `png`, `gif`, `webp` and `:143` passes `image/*` through as an image block. So a photographed
permit can be read by the route and cannot be selected on the page. `docs/TODO.md:2799` records it; it is
unchanged.

### D11. Not a disagreement — three doc claims checked and found correct

Recorded so they are not re-litigated:
- **`DECISIONS.md` §11051** — *"the main calendar shows the grey word 'hr' with no link
  (`app/calendar/page.tsx:526`)"*. Line 526 is
  `{e.category && <span className="text-xs text-gray-400">{e.category}</span>}`. Correct, with one
  qualification: that is the **List view only**; the month grid (`:459–466`) prints the title alone.
- **`docs/HANDOFF-FROM-HR.md` §6** — *"`calendar_events.handbook_id` exists (nothing writes it while the
  Dates feature is parked)"*. Correct: 066:305 added it; no write exists anywhere.
- **`cal-route:59–62`** — *"Migration 040 added the column; this is the first caller to fill it"*, of
  `document_id`. Correct: `040:195`. One addition: **no UI sends `document_id` to this route** — `cal-page`
  never includes it — so the only populated values come from `doc-actions:145`.

---

## The shared files any calendar change will touch, by the section that owns them

In the shape `docs/HANDOFF-FROM-HR.md` §6 and `docs/TEST-AT-FINISH-LINE.md` J use. The cross-section rule
(`DECISIONS.md` §180): **a section that changes a shared file before the finish line re-runs the free checks
(`npm run check`, `check:live` on 3999) of every section that uses it.**

**Owned by the Calendar section (nothing else reads them):**
- `app/calendar/page.tsx`, `app/api/calendar/route.ts`
- `app/api/extract-dates/route.ts`, `prompts/extract-dates.ts` — and **whether to keep the import feature at
  all is the Calendar section's decision** (`docs/INVENTORY-2026-09.md:164`)

**Documents — changing these changes the Documents report, the Documents golden set and the dashboard:**
- `lib/documentScan.ts` — `chooseSignificantDate` (:235–285), `normaliseScan` (:365–380), the
  `document_deadlines` insert (:893–898). **And `document_index_v` (migration 049) repeats the same rule in
  SQL: a change to one is a change to both.**
- `components/DocumentReport.tsx` — section 6, :810–838, the `deadline_to_calendar` button
- `app/api/document-actions/route.ts` — the `deadline_to_calendar` case, :127–152 (and D6)
- `app/api/documents/report/route.ts:43`
- `tests/unit/significantDate.test.ts` — the only date tests in the suite
- `tests/golden/` — the documents golden set reads deadlines

**Audits:**
- `components/AuditReport.tsx` — the Dates section (:1016–1060) and the `/calendar?add=` link (:1052)
- `app/audits/page.tsx` — the `Deadline` type (:38–40), `deadlinesFor` (:853), the lines (:891–911)
- `lib/auditRun.ts` — the two shapers (:580–720, :830–895), `reshaped_to_dates` / `dropped_undated`
- `app/api/audits/index/route.ts:68–81`, `lib/audit.ts:174–178`
- `lib/auditNotify.ts` — if a calendar email copies it

**HR:**
- `handbook_dates` and `calendar_events.handbook_id` — **parked**, with the design on the unpushed branch
  `parked/hr-check-structured` (`391fd05`). A calendar change to `calendar_events` must not break what that
  branch expects: `docs/HANDOFF-FROM-HR.md` §8, "Returns with switch 5".
- `app/hr/HrWorkspace.tsx:53, 155, 902–919` — the hidden Dates tab, and
  `tests/unit/hrPolish.test.ts:14–18`, which **asserts no file in `app/hr/` reads `calendar_events`**: a
  calendar change that wires HR's dates up must change that test deliberately.
- `lib/handbookCheckNotify.ts` — if a calendar email copies it

**The Compliance Workspace:**
- `prompts/checklist.ts` `buildSystemPrompt` (:326–363) — **anything built from it changes HR's answers too**
- `lib/companyContext.ts` (:63–67, :223), `lib/conversation.ts`, `lib/topicClaim.ts`, `lib/topicList.ts`
  (:49, :55–63), `lib/summaryReport.ts` (:422–443), `lib/listWords.ts`, `lib/summaryWords.ts`
- `config/examples.ts` — the owner's file
- `components/AnswerBody.tsx`, `ReportView.tsx`, `ConversationList.tsx`, `Drawer.tsx`, `Sheet.tsx`,
  `Tabs.tsx`, `Empty.tsx`, `buttonStyles.ts`, `lib/printFrame.ts`

**Everything (a change here touches every section):**
- `lib/ai.ts` (:27, :96–152, :249–251) and `lib/costLedger.ts` (:22–41) — C7's five-point change
- `app/api/account/route.ts` (:217, :220, :240, :260) and `app/api/account/export/route.ts` (:91, :103)
- `scripts/check-schema-contracts.js` — check 2 **fails the build** if a new table with `company_id` is in
  neither list
- `scripts/check-live.js` — where `calendar_events` probes belong (B10)
- `scripts/schema-doc.js` (:197–201, :206–209, :223–226) — the module map and the composite-FK rendering (D3)
- `vercel.json`, `lib/cronSecret.ts`, `lib/jobAuth.ts` (:66), `lib/jobRun.ts` (:27) — and **migrations for
  `job_runs_job_check`, `ai_calls_task_check` and `topics_section_is_known`** if the calendar gains a job, a
  ledger task or its own conversations
- `app/dashboard/page.tsx` (:16, :64–66, :106–111, :207–229) — the only other screen that reads the calendar
- `docs/SCHEMA.md` — regenerated by `db:migrate`; four of Part D's rows are its stale or mis-rendered output

---

## What this document could not see, and why

- **`audit_findings` is empty on staging**, so no claim here about `kind = 'date'` rows is backed by a row.
  Everything in B3 comes from the CHECK, the shaper and the renderer. The 072 rebuild of 14 October is why.
- **D7 is PLAUSIBLE, not CONFIRMED.** The static chain is complete; nothing was executed against a server,
  because this job is read-only and confined to port 3999. The one-step settlement is written out in D7.
- **D6's cause is a hypothesis.** The behaviour is read off the line; why it was written that way is not in
  the repository.
- **Production was not queried.** `npm run preflight` is read-only and reads the migration history only; no
  `SELECT` was issued against production, because nothing in the brief needed one.
- **One of this job's own probes named a table that does not exist** — `sites`. There is no `sites` table;
  sites are `entities` with `entity_type = 'site'` (`060:76–77`). The probe printed `null` rather than a
  number, so it did not mislead, and it is recorded because it is the exact shape of
  `HOW-WE-BUILD.md` §3's *"a check that cannot see anything looks exactly like a check that found nothing"*
  — in a throwaway script, which is where that rule says it bites.
- **`calendar-attempt-1` was not read.** Nothing here derives from it, and nothing needed it.
