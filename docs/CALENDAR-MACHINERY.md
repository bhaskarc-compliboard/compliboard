# The Calendar, and everything that writes a date into it — how it works, end to end

**Written:** 9 October 2026, Calendar Step 1. **Read-only.** No code was changed and no model was called. The cost
ledger read **298 calls, $18.46** at the start and **298 calls, $18.46** at the end (`npm run cost`, the `TOTAL` line).

**Method.**
- Every claim points at `file:line`, a migration line, or a query whose SQL and output are printed here.
- A claim that cannot point at a line is labelled **HYPOTHESIS**, with what would settle it.
- Line numbers are from commit `54ec6ae`.
- Grants, policies, constraints and indexes were **read from staging** (`amzsav…`, the ref in `.env.local`), not taken
  from the migration text. The Supabase CLI connects there as `supabase_read_only_user` (read back in §C1).
- The numbered **B-items** at the end are the facts a later decision will cite.

**Abbreviations.**
- `page` = `app/calendar/page.tsx` (601 lines)
- `route` = `app/api/calendar/route.ts` (152 lines)
- `actions` = `app/api/document-actions/route.ts`
- `dash` = `app/dashboard/page.tsx`
- Migrations are under `supabase/migrations/`, cited by number (`040:195`).

At the end of each part, "Baseline piece that could replace it" names shared files that HR and the workspace built
(`docs/HANDOFF-FROM-HR.md` §6, §12).

---

## PART A — every path that reads or writes the three tables

### A1. The table `calendar_events`, as staging holds it

**Columns (read from staging).**
```
id uuid not null, company_id uuid, user_id uuid, title text not null, description text, due_date date not null,
category text, is_recurring boolean, recurrence_period text, completed boolean, completed_at timestamptz,
created_at timestamptz, entity_id uuid, document_id uuid, handbook_id uuid
```

| Column(s) | Added by | Note |
|---|---|---|
| `id` … `created_at` | `000:90–103` | `company_id` is **nullable**. `category` and `recurrence_period` are free text. There is no `updated_at` |
| Policies `auth.uid() = user_id` | `000:445–480` | Replaced by 003, then by 004 |
| Company-scoped policies | `003:173–203` | 003's note: 47 production rows on that day, all with a `company_id` (`003:48–53`) |
| Four policies on `auth_company_id()` | `004:128–142` | The current policies (C1) |
| `revoke all … from anon` | `004:397` | Baseline granted `all` to anon and authenticated (`000:758`) |
| `category` and `recurrence_period` left as text | `006:66–71` | "All 47 rows hold `compliance`." The dropdown's ten values do not include `compliance`. The stored set and the offered set are **disjoint**. "Needs its own decision" |
| `entity_id` → `entities` ON DELETE SET NULL | `009:98–99`, index `009:109` | "an air permit renewal belongs to the plant holding the permit" (`009:88`). **Nothing writes it** (B13) |
| `document_id` → `documents` ON DELETE SET NULL | `040:195` | Written by the Documents button (A4) and by `route` POST when a body carries one (A2) |
| `handbook_id`, FK `(company_id, handbook_id)` → `handbooks` ON DELETE SET NULL (handbook_id) | `066:300–313` | Written only by the parked HR route (A7) |
| TRUNCATE, TRIGGER, REFERENCES taken from people | `067:6`, `067:109–111` | |

**Constraints (read from staging).**

```sql
select conrelid::regclass as tbl, conname, confdeltype, pg_get_constraintdef(oid) as def from pg_constraint
 where conrelid in ('public.calendar_events'::regclass,'public.document_deadlines'::regclass,'public.handbook_dates'::regclass)
   and contype in ('f','c') order by 1,2
```
```
calendar_events  calendar_events_company_id_fkey           c  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
calendar_events  calendar_events_document_id_fkey          n  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
calendar_events  calendar_events_entity_id_fkey            n  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL
calendar_events  calendar_events_handbook_in_same_company  n  FOREIGN KEY (company_id, handbook_id) REFERENCES handbooks(company_id, id) ON DELETE SET NULL (handbook_id)
calendar_events  calendar_events_user_id_fkey              c  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
document_deadlines document_deadlines_calendar_event_id_fkey n FOREIGN KEY (calendar_event_id) REFERENCES calendar_events(id) ON DELETE SET NULL
document_deadlines document_deadlines_company_id_fkey      c  … companies(id) ON DELETE CASCADE
document_deadlines document_deadlines_document_id_fkey     c  … documents(id) ON DELETE CASCADE
document_deadlines document_deadlines_scan_id_fkey         c  … document_scans(id) ON DELETE CASCADE
handbook_dates   handbook_dates_calendar_event_id_fkey     n  … calendar_events(id) ON DELETE SET NULL
handbook_dates   handbook_dates_check_in_same_company      n  … handbook_checks(company_id, id) ON DELETE SET NULL (check_id)
handbook_dates   handbook_dates_company_id_fkey            c  … companies(id) ON DELETE CASCADE
handbook_dates   handbook_dates_handbook_in_same_company   c  … handbooks(company_id, id) ON DELETE CASCADE
handbook_dates   handbook_dates_source_check                  CHECK ((source = ANY (ARRAY['handbook'::text, 'rule'::text])))
```

- **No CHECK on `calendar_events` at all.** Nothing limits `category` or `recurrence_period`, and **no unique key**
  stops the same title and date twice (B9).
- **`user_id` ON DELETE CASCADE** (`000:364`, read back above). Deleting a person's login deletes every calendar
  event that person created, though the calendar is a company asset (`route:74–77`) (B10).

**Indexes (read from staging):** `calendar_events_pkey`, `idx_calendar_events_entity`,
`idx_calendar_events_company_handbook`. There is **no index on `(company_id, due_date)`**, which is the read `route`
GET makes (`route:84–88`).

**Triggers:** none on any of the three tables.
```sql
select count(*) filter (where tgrelid in ('public.calendar_events'::regclass,'public.document_deadlines'::regclass,
       'public.handbook_dates'::regclass)) as on_these, count(*) as in_public
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where not tgisinternal and n.nspname='public'
→ {"in_public": 18, "on_these": 0}
```
The same query sees 18 triggers elsewhere, so the zero is a finding and not a blind check.

### A2. The calendar route (`route`)

All four handlers run as the caller under RLS through `requireCompany` (`route:34`, `:80`, `:99`, `:129`). Without a
token, `requireCompany` answers `401 {"error":"Unauthorized"}` (`lib/auth.ts:80`).

| Method | Lines | What it does |
|---|---|---|
| POST | 32–72 | Needs `title` and `due_date` (41–43). It checks `document_id` belongs to the company (48–51), then inserts with the session's `company_id`/`user_id` and the body's `title, description, due_date, category, is_recurring, recurrence_period` **as sent** (53–63). **It takes no `entity_id` and no `handbook_id`.** No date validation beyond Postgres's `date` type. No duplicate check |
| GET | 78–95 | `select('*')`, the whole company, ordered by `due_date`. No range, no limit |
| PATCH | 97–125 | Ownership read (107), then sets `completed` and `completed_at` (111–118). It changes nothing else: **no title, date or recurrence edit exists anywhere** |
| DELETE | 127–152 | Ownership read (137), then a hard delete (141–145). The event is gone; a `document_deadlines`/`handbook_dates` row that pointed at it goes back to null (`calendar_event_id` SET NULL, A1), so its report offers "Add to calendar" again |

### A3. The calendar page (`page`)

**What it holds.** `CalendarEvent` (8–18) has no `document_id`, `entity_id`, `handbook_id` or `created_at`. So the
page **cannot show where a date came from**, and does not try (B12). `description` is never drawn on the page; it
reaches only the Google and Outlook links (247–256).

**Every call it makes.**

| Line | Call | Header | Outcome |
|---|---|---|---|
| 100–108 | `auth.getUser`, `profiles.company_id` (browser client) | — | Company |
| 112 | `GET /api/calendar` | `authHeaders()` | All events |
| 129–140 | `POST /api/calendar` (Add form) | `authHeaders()` | One row. No `document_id` |
| 170–172 | `POST /api/extract-dates` (Import) | `authHeaders()` | Model call (A5) |
| 203–214 | `POST /api/calendar` per picked date, `category: 'compliance'` | `authHeaders()` | One row each. **The loop ignores a failed row**, and 218 says "Added N dates" with N = how many were picked (B14) |
| **234–238** | `PATCH /api/calendar` (the done tick) | **`{ 'Content-Type': 'application/json' }` only** | **401; nothing saved (2a, B1)** |
| 244 | `DELETE /api/calendar?id=` | `authHeaders()` | The response is not read; the row leaves the screen first (243) |

**The prefill (Audits Run 3b).** `useSearchParams` (78), then the effect at 79–88: `?add=` fills the title (sliced
to 200), `?on=` fills the date if it matches `YYYY-MM-DD`, and the form opens. Nothing is written until Save.

**The date arithmetic.** Three different readings of the same `due_date` string sit on one page.

| Lines | Expression | Reads `'2026-11-01'` as |
|---|---|---|
| 261–264 (month list), 271–275 (30-day banner), 277–280 (overdue banner) | `new Date(e.due_date)` | **UTC midnight**: 31 Oct 17:00 in Oregon |
| 267–268 (grid cell) | string compare `e.due_date === dateStr` | 1 November, correctly |
| 513–516 (list rows), 483, 533 | `new Date(e.due_date + 'T00:00:00')` | local midnight, correctly |

2b prints what each one returns.

**Text a person sees that is not true today.**
- `didYouKnow` (283): "Upload your permits … in Company Files, click Extract dates, and CompliBoard will find all
  renewal and expiry dates and add them to your calendar automatically." There is no "Extract dates" in Documents:
  the only caller of `/api/extract-dates` is this page (`page:170`; a grep finds no other). Nothing goes to the
  calendar automatically (`lib/documentScan.ts:701–704`).
- The empty state (504) says the same.
- B15 lists the same claim on the landing page and the account page.

### A4. Documents: the scan, the report, and "Add to calendar"

**The scan writes deadlines and never events.**
- `saveScan` writes them at `lib/documentScan.ts:893–898`: `scan_id, document_id, company_id, title, due_on,
  source_line, recurs`.
- "IT WRITES NOTHING TO … `calendar_events`" (`:701–704`).
- `ScanDeadline` is `{ title, due_on, source_line, recurs: boolean }` (`:101`). The prompt asks for exactly that
  (`prompts/document-scan.ts:242`, schema `:395`). **There is no recurrence period anywhere in a deadline.**
- **`source_line` is not checked against the document.** Gaps' and facts' quotes go through `verifyQuote`
  (`:335`, `:351`), and the scan counts only those two (`:682`). The deadline's line is stored as returned
  (`:344`), and `document_deadlines` has no `quote_verified` column (A1) (B16).

**The report reads every reading's deadlines, not only the current one's.**
- `app/api/documents/report/route.ts:43`: `document_deadlines … .eq('document_id', documentId)`, with no
  `scan_id` filter.
- Gaps on the same route are split into "now" and "from earlier readings" (`:80–83`). Deadlines are not.
- `components/DocumentReport.tsx:811–833` draws every row it gets. Each has "Add to calendar" when it has a day and
  no `calendar_event_id`, or "In your calendar" when it has one.

**The button.** `DocumentReport.tsx:828` → `actions:127–152`, `deadline_to_calendar`:
- Reads the deadline as the caller (130–135).
- **Checks** `calendar_event_id` (136), refuses one with no day (137–139).
- Inserts one event as the caller: `category: 'document'`, `description: source_line`, `document_id`, **no
  `entity_id`** (140–146).
- Writes `calendar_event_id` back with the service role (148–150). `authenticated` holds UPDATE on
  `document_deadlines` (C1), so the service role is not needed for permission. The file's header names it for
  corrections, gaps and proposals (`actions:17–22`), not for this.
- **`recurrence_period: dl.recurs ? 'annually' : null` (144).** Every recurring deadline becomes "annually",
  whatever the document said (2c, B4).
- **Check-then-insert, not compare-and-set.** Two presses that cross both pass 136 and insert twice. The parked HR
  route says so in its header: "Documents checks first and could insert twice when two presses cross"
  (`parked/hr-check-structured:app/api/hr/handbook-dates/[id]/calendar/route.ts:9–10`). That route's fix is at
  `:49–57` (B8).

### A5. The import: `/api/extract-dates` and `prompts/extract-dates.ts`

- `requireCompany` first (`extract-dates:18–20`), then the parser (`:38`). An unreadable file returns
  `extraction_failed` with the reason (`:39–55`). Any other failure returns `extraction_error` (`:84–93`).
- `askAIJson(EXTRACT_PROMPT, …, { maxTokens: 1000, ledger: { companyId, task: 'other' } })` (`:67–70`).
- **The result goes back unvalidated** (`:72`). There is no Zod, and no check of `date` or of the description
  against the file.
- The prompt (`prompts/extract-dates.ts:6–35`) works without an anchor in three ways:
  - It asks for "any important dates" and "Maximum 10 dates per document" (35). It asks for **no source line**:
    `description` is "One sentence context" (25).
  - "**set is_recurring to true and recurrence_period to "annually"**" for any annual or recurring item (32).
  - "Only include dates that are in the future or within the last 30 days" (34), **but the message carries no
    date** (`extract-dates:57–60`). **HYPOTHESIS:** the model judges "future" against its own idea of today.
    Settled by one Haiku call with a fixture dated last year, which this step did not make.
- The file is **not stored** and the event gets **no `document_id`** (`page:203–214`).
- This is the mode `docs/TODO.md` M5 (2828–2846) records as unanchored ("Enumerating a company's deadlines from a
  document is the unanchored mode").

### A6. Audits: "Add to calendar" on a date finding

- `components/AuditReport.tsx:1052–1056`:
  `<a href={`/calendar?add=${encodeURIComponent(f.title)}&on=${f.due_on ?? ''}`}>`.
  - Offered on every date finding with a day (`!undated`, 1051), **passed ones included** (1047).
  - Not offered on an undated recurring one (1029–1031).
- The link carries **the title and the date only**. `f.document` is in scope (1036) and is dropped.
- It lands in the page's prefill (`page:79–88`) and is saved by `handleAddEvent` (`page:121–156`). That body
  (132–139) has no `document_id` and no audit or finding id, and the route has no column for an audit (A1).
- **Pressing it twice makes two rows.** Each press is a navigation plus a Save. `route` POST is a plain insert
  (53–65), and nothing in A1's constraints is unique on title or date. A finding also cannot show "In your
  calendar", because nothing records that it was sent (B7).

### A7. HR

- **The Dates tab is hidden and loads nothing.**
  - `app/hr/HrWorkspace.tsx:154–155`: `const [dates] = useState<DateRow[]>([])`, "nothing loads them today".
  - `:280–281`: "THE DATES TAB IS HIDDEN (owner, Step 11a) … parked on `parked/hr-check-structured`".
  - The tab's markup stays (`:903–906`, with `Empty`).
  - `tests/unit/hrPolish.test.ts:17` asserts the page does not read `calendar_events`.
- **`handbook_dates` exists and nothing on `main` writes it.**
  - Table at `066:214–240`. Grants and policies are SELECT and UPDATE only (`066:351`, `:378–384`; read back in C1).
  - The writer and the "Add to calendar" route live only on the parked branch: `lib/handbookCheck.ts`,
    `lib/handbookReport.ts` and `app/api/hr/handbook-dates/[id]/calendar/route.ts` (`git grep` on
    `parked/hr-check-structured`).
  - That route inserts `category: 'hr'`, the handbook's site as `entity_id` and `handbook_id`
    (`…/calendar/route.ts:40–46`).
  - **It also writes `recurrence_period: 'annually'`** for any recurring date (`:44`).
- **Handbook delete.**
  - `app/api/handbooks/route.ts:66–69` and `lib/handbookDelete.ts:11`: dates cascade with the handbook.
  - A calendar event made from one stays, with `handbook_id` set to null (`066:307`, read back in A1).
- **Staging holds one `'hr'` event.** It was made on 8 Oct by the parked code, for Test Gamma Solvents (C2).

### A8. The dashboard

- `dash:64` reads `GET /api/calendar` with the token.
- `dash:110–114`: upcoming means `new Date(e.due_date) >= new Date(now.toDateString()) && <= in30`, sorted by string.
  **It does not exclude completed events** (B5).
- `dash:116–119`: `daysUntil` uses `new Date(dateStr)` (UTC midnight) against local midnight.
- `dash:216–228`: "Today" / "Tomorrow" / "in N days"; red when ≤ 7.

### A9. Account delete and export

- **Delete:** `app/api/account/route.ts`
  - Names `handbook_dates` (217) and `calendar_events` (220) in the delete list.
  - Lists `document_deadlines` under "deleted by cascade" (240).
- **Export:** `app/api/account/export/route.ts` includes `calendar_events` (91, 191, 216) and `handbook_dates` (103,
  202, 227). It does **not** include `document_deadlines`, and its description text names "calendar events" (162).
  **HYPOTHESIS** that leaving deadlines out is deliberate (they are "our reading", like the scan tables in the delete
  list's note at `account/route.ts:231–238`). Settled by asking the owner.

### A10. The checks

- **`check:live` never touches `calendar_events` or `/api/calendar`.** A grep for either in `scripts/check-live.js`
  finds nothing.
- It probes `handbook_dates`' grants (`:219–299`) and seeds one `document_deadlines` row for an audit fixture
  (`:1059`).
- `scripts/schema-doc.js:226` files `calendar_events` under "Calendar".
- No unit test covers the page, the route or the date arithmetic. The only test hits are `retention.test.ts:52`
  (an unrelated phrase) and `hrPolish.test.ts:17`.
- `STATUS.md:229` reads "Calendar ✅ working, 11 Sep". That is two days after the tick stopped saving (B1).

### A11. Grants and policies, as read on staging

```sql
select t.tbl, r.role, string_agg(p.priv, ',' order by p.priv) filter (where has_table_privilege(r.role, 'public.'||t.tbl, p.priv)) as holds
  from (values ('calendar_events'),('document_deadlines'),('handbook_dates')) t(tbl)
 cross join (values ('anon'),('authenticated')) r(role)
 cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(priv)
 group by 1,2 order by 1,2
```
```
calendar_events    anon           NULL
calendar_events    authenticated  DELETE,INSERT,SELECT,UPDATE
document_deadlines anon           NULL
document_deadlines authenticated  SELECT,UPDATE
handbook_dates     anon           NULL
handbook_dates     authenticated  SELECT,UPDATE
```
```sql
select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies
 where schemaname='public' and tablename in ('calendar_events','document_deadlines','handbook_dates') order by 1,3
```
```
calendar_events    calendar_events_delete        DELETE {authenticated} (company_id = auth_company_id())  NULL
calendar_events    calendar_events_insert        INSERT {authenticated} NULL                              (company_id = auth_company_id())
calendar_events    calendar_events_select        SELECT {authenticated} (company_id = auth_company_id())  NULL
calendar_events    calendar_events_update        UPDATE {authenticated} (company_id = auth_company_id())  (company_id = auth_company_id())
document_deadlines document_deadlines_select_own SELECT {authenticated} (company_id = auth_company_id())  NULL
document_deadlines document_deadlines_update_own UPDATE {authenticated} (company_id = auth_company_id())  (company_id = auth_company_id())
handbook_dates     handbook_dates_select_own     SELECT {authenticated} (company_id = auth_company_id())  NULL
handbook_dates     handbook_dates_update_own     UPDATE {authenticated} (company_id = auth_company_id())  (company_id = auth_company_id())
```
Every policy uses `auth_company_id()`, and `anon` holds nothing. A person may update **any column** of a company's
deadline row, `title` and `due_on` included. The route only ever sets `calendar_event_id`, through the service role.

### A — Baseline piece that could replace each part

| Today | Baseline piece |
|---|---|
| Page's hand-made tab bar (`page:303–312`) | `components/Tabs.tsx:13` (`Tabs`), as HR uses it (`HrWorkspace.tsx:637`) and the workspace (`compliance/page.tsx:1038`) |
| Green buttons with inline classes (`page:292–299`, `:412–415`) | `components/buttonStyles.ts` `PRIMARY` (14), `SECONDARY_LARGE` (18), `OUTLINE` (22), `TEXT_ACTION` (25) |
| `confirm('Delete this deadline?')` (`page:242`) | `components/Sheet.tsx:10`, as HR's delete sheet (`HrWorkspace.tsx:599–612`, `:1134`) |
| The fixed popup of found dates (`page:551–596`) and the Add form (`:352–417`) | `components/Drawer.tsx` (`Drawer`, `printDrawer`, `printDate`, 96) for one event with its source; `Sheet` for the form |
| The 📅 empty state (`page:500–509`) | `components/Empty.tsx:7` |
| No print | `lib/printFrame.ts` `printWithFrame` (70), `printFrameCss` (39), `printDate` (57) |
| A row per event with no source | Documents' deadline row (`DocumentReport.tsx:814–833`): title · date · repeats · Passed, then the source line, then "Add to calendar" or "In your calendar" |
| The import popup's select-all list (`page:561–592`) | Company information's confirm queue: a group heading, "Confirm all N" (`app/company-information/page.tsx:511–514`) calling `confirmAll` (252–273) **one after another, a 404 counted as already settled**, plus each item's own answer (238–250). That is the pattern for a "To confirm" tab of found dates with a group confirm |

---

## PART B — the brief's four statements, proved or disproved

### 2a. The done tick never saves — **PROVED**

**Method.**
- An isolated copy of the working tree, run on port 3998 under the guard (`HOW-WE-BUILD.md` §3c):
  - `rsync -a --exclude .next --exclude node_modules --exclude .git --exclude shots ./ <scratch>/app3998/`
  - `cp -cR node_modules <scratch>/app3998/`
  - `env HR_PREVIEW=1 node scripts/haiku.mjs npx next dev -p 3998`
- The guard printed `haiku check: 12 of 12 tiers on claude-haiku-4-5` before the server started.
- The server pointed at staging: the URL host begins `amzsav`, staging's ref; production's begins `dsfwma`.
- Signed in as `testalpha@example.com`, Test Alpha holds **no** events (`GET … rows: 0`). So one probe event was
  made through the route's own POST, toggled, and removed through its own DELETE.
- No model is called by this route. The ledger did not move.

**Output, verbatim.**
```
GET /api/calendar with token -> 200 rows: 0
POST probe event with token -> 200 0b7413a4-0ccc-4b8e-8015-a8f01f5a8019
event: 0b7413a4-0ccc-4b8e-8015-a8f01f5a8019 {"title":"Calendar Step 1 probe","due_date":"2026-11-01","completed":false}

PATCH WITHOUT token, completed=true -> 401 {"error":"Unauthorized"}
  completed read back: false

PATCH WITH token, completed=true -> 200 {"success":true}
  completed read back: true

restore completed=false -> 200 ; read back: false
DELETE probe -> 200 ; rows now: 0
```
**The server's own log** (`next dev`, port 3998):
```
PATCH /api/calendar 401 in 6ms
GET /api/calendar 200 in 165ms
PATCH /api/calendar 200 in 297ms
```
The "without" call sends exactly the page's headers (`page:236`).

**What the person sees.**
- The tick turns green at once (`page:233`, optimistic), and the 401 is never read (`page:234–238` ignores the
  response).
- On reload the event is not done.
- The same is true on the dashboard's count and the overdue banner.

**Since when.**
- Commit `b992996` (9 September 2026) put `requireCompany` on all four handlers.
- `git log -L231,239:app/calendar/page.tsx` shows only `2c42429` (4 June) ever wrote those lines, so the PATCH never
  carried a token.
- The tick has not saved since 9 September. `STATUS.md:229` says "working, 11 Sep".

The copy was deleted afterwards (`rm -rf "${S:?}/app3998"`; only the log was left in scratch) and the server stopped
(`lsof` on 3998: nothing).

### 2b. The off-by-one day — **PROVED**, in three places

**Method.** The page's and dashboard's expressions were copied verbatim into node and run under
`TZ=America/Los_Angeles`. "Now" was fixed at two moments: 9 Oct 09:00, a morning, and 31 Oct 18:00, the evening
before the 1st.

```
=== "now" = Fri Oct 09 2026 09:00:00 GMT-0700 (Pacific Daylight Time)
due 2026-10-09:
  new Date(due_date)              = Thu Oct 08 2026 17:00:00 GMT-0700
  page:261-264 month counted in   = 2026-10   (getDate() = 8)
  page:271-275 diff, upcoming      = -0.667, false
  page:277-280 overdue             = true
  page:513-516 list row diff/label = 0, Due today
  dashboard:113 in "next 30 days"  = false
  dashboard:116-119 daysUntil      = 0 -> "Today"
due 2026-11-01:
  new Date(due_date)              = Sat Oct 31 2026 17:00:00 GMT-0700
  page:261-264 month counted in   = 2026-10   (getDate() = 31)
  page:271-275 diff, upcoming      = 22.333, true
  page:277-280 overdue             = false
  page:513-516 list row diff/label = 23, Due in 23 days
  dashboard:113 in "next 30 days"  = true
  dashboard:116-119 daysUntil      = 23 -> "in 23 days"

=== "now" = Sat Oct 31 2026 18:00:00 GMT-0700 (Pacific Daylight Time)
due 2026-11-01:
  page:261-264 month counted in   = 2026-10   (getDate() = 31)
  page:271-275 diff, upcoming      = -0.042, false
  page:277-280 overdue             = true
  page:513-516 list row diff/label = 1, Due in 1 days
  dashboard:113 in "next 30 days"  = true
  dashboard:116-119 daysUntil      = 1 -> "Tomorrow"
```

**What that means on screen in Oregon.**
1. **A date due today is "Overdue"** in the red banner (277–280) and **not** in "Due in 30 days" (271–275), while
   its own list row says "Due today" (513–516). The two parts of the page contradict each other.
2. **A date due today is missing from the dashboard's "Upcoming — next 30 days"** (113 is false), so the dashboard
   says nothing on the day it matters.
3. **A 1st-of-the-month date is listed under the previous month's "This month"** (261–264 counts it in October).
   The grid draws it on 1 November (267–268, string compare). So October's list holds an event its grid does not
   show, and November's list omits one its grid shows.
4. **The evening before the 1st, a 1 November date is already "Overdue"** in the banner, while its row says "Due in
   1 days".

The cause is one expression, `new Date('YYYY-MM-DD')`, which JavaScript reads as UTC midnight. The list rows already
use the right form, `+ 'T00:00:00'` (513).

### 2c. Recurrence — **PROVED: nothing creates a next occurrence**

```
$ grep -rnE "recurrence_period|is_recurring" app lib components scripts worker supabase/functions vercel.json  (database.types excluded)
app/calendar/page.tsx:14,15,93,137,138,211,212,530      the type, the form, the import, the 🔄 label
app/api/calendar/route.ts:39,58                         stored as sent
app/api/document-actions/route.ts:144                   'annually' for every recurring deadline
app/api/documents/route.ts:30,109,110                   a documents column, not the calendar
app/api/account/export/route.ts:138,147,148             export

$ grep -rniE "next occurrence|nextOccurrence|addMonths|addYears|setFullYear|annually" app lib components scripts
app/calendar/page.tsx:65,407                            the dropdown's default and option
app/api/document-actions/route.ts:144
lib/retention.ts:30,41,49                               addMonths — transcript retention, not dates
scripts/check-live.js:652                               a test question's words

$ grep -rniE "recurrence|is_recurring" supabase/migrations   (comment lines excluded)
000_baseline.sql:98,99,225,226                          the two columns, on calendar_events and on documents
060_…sql:183                                            a comment string about audit findings

vercel.json crons: summarise, delete, scan-documents, audit-sections, handbook-queue, handbook-checks — none touches the calendar
worker/: does not exist
```
- **The only recurrence is a label:** `🔄 {e.recurrence_period}` (`page:530`).
- A yearly permit renewal, once its date passes, stays as one past event. It is "Overdue" until ticked, which
  cannot be saved (2a). After that, nothing.
- **`'annually'` for every recurring deadline (`actions:144`).**
  - The scan records only `recurs: boolean` (`lib/documentScan.ts:101`), so the route has no period to copy and
    writes "annually".
  - The parked HR route does the same (`…/calendar/route.ts:44`). The import prompt tells the model to (A5).
  - **Staging shows why it is wrong.** The only recurring deadlines held are monthly: "Items marked N are reported
    to the Plant Manager **by the 5th**" (C3). Given a day, that would be sent to the calendar as "annually".

### 2d. Audits' "Add to calendar" carries no source, and twice makes two rows — **PROVED from the code path**

- **The link** (`AuditReport.tsx:1052`) carries `add` and `on` only.
- **The prefill** (`page:80–87`) reads `add` and `on` only.
- **The save** (`page:132–139`) sends `title, description, due_date, category, is_recurring, recurrence_period`.
  There is no `document_id`, and `category` is null unless picked.
- **The route** (`route:53–63`) inserts what it is given.
- So **the saved event carries no `document_id` and no audit link**, though the finding knows its document
  (`AuditReport.tsx:1036`).
- **Twice:** the insert is unconditional and A1 shows no unique constraint, so two Saves make two rows. The finding
  never learns it was sent, so it offers the link again. No paid run was needed; nothing here calls a model.

---

## PART C — the databases

### C1. Who the CLI is on staging
```sql
select current_user, session_user, (select count(*) from public.companies) as companies_visible
→ supabase_read_only_user | supabase_read_only_user | 6
```

### C2. The stated query, on staging (item 6)
```sql
select category, (document_id is not null) as has_doc, (handbook_id is not null) as has_hb,
       is_recurring, completed, count(*)
  from public.calendar_events group by 1,2,3,4,5 order by 6 desc;
```
```
category | has_doc | has_hb | is_recurring | completed | count
hr       | false   | true   | true         | false     | 1
```
The one row:
```sql
select e.title, e.due_date, e.recurrence_period, e.created_at, c.name as company,
       (select count(*) from public.handbook_dates hd where hd.calendar_event_id = e.id) as from_handbook_dates
  from public.calendar_events e join public.companies c on c.id = e.company_id
→ Open enrolment window for health benefits | 2026-11-01 | annually | 2026-10-08 05:09:32+00 | Test Gamma Solvents | 1
```
It came from the parked HR route on 8 October. It is "annually" by that route's rule (`:44`).

### C2-prod. The same query on PRODUCTION — **NOT RUN**

The command was:
```
npx supabase db query --project-ref <SUPABASE_PROD_REF> --linked -o table "<the SQL above>"
```
The credential would have been the Supabase CLI's own login (its access token). The connection's role was not going
to be queried, because the brief allows one statement.

**This session's permission system refused the call** ("Production Reads"). It was not retried and not attempted any
other way. **The answer to "how many events exist on production, and from which source" is therefore not known from
this step.** The latest known figure is `003:48–53` and `006:66–67`: 47 rows, all `category = 'compliance'`, on the
day those migrations were written.

**For the owner to run, if you want the figure** (read-only, the brief's SQL verbatim):
```
! npx supabase db query --project-ref $(node --env-file=.env.local -e 'process.stdout.write(process.env.SUPABASE_PROD_REF)') --linked -o table "select category, (document_id is not null) as has_doc, (handbook_id is not null) as has_hb, is_recurring, completed, count(*) from public.calendar_events group by 1,2,3,4,5 order by 6 desc;"
```

### C3. Documents' deadlines across re-reads and versions, on staging (item 3)

**Deadlines by whether their reading is current:**
```sql
select s.is_current, count(*) as deadlines, count(distinct dd.document_id) as documents,
       count(dd.calendar_event_id) as sent_to_calendar
  from public.document_deadlines dd join public.document_scans s on s.id = dd.scan_id group by 1 order by 1
→ false | 2  | 1  | 0
  true  | 36 | 11 | 0
```
**The re-read document, row by row:**
```sql
select s.scanned_at::date as read_on, s.is_current, dd.title, dd.due_on, dd.recurs, left(dd.source_line, 60) as source_line
  from public.document_deadlines dd join public.document_scans s on s.id = dd.scan_id
  join public.documents d on d.id = dd.document_id where d.name = '13-company-self-check.docx' order by s.scanned_at, dd.title
→ 2026-10-04 | false | Complete the monthly EHS self-check and get supervisor review | NULL | true | Supervisor review: ____________________ Date: __________
  2026-10-04 | false | Report any items marked N to the Plant Manager                | NULL | true | Items marked N are reported to the Plant Manager by the 5th
  2026-10-04 | true  | Report unchecked items to Plant Manager                       | NULL | true | Items marked N are reported to the Plant Manager by the 5th
```
**Versions on staging:**
```sql
select count(*) filter (where version_of is not null) as newer_versions,
       count(*) filter (where version_of is not null and version_confirmed) as confirmed, count(*) as documents
  from public.documents
→ 0 | 0 | 12
```
The query sees 12 documents. **No document on staging has a newer version**, so the version filter below could not
be shown biting on real rows.

---

## PART D — the four maps the brief asked for

### D3. Re-reads and versions (item 3, exact)

**When a document is read again** (`lib/documentScan.ts` `saveScan`):
1. Every earlier scan of the document gets `is_current = false` (744). The new scan is inserted with
   `is_current: true` (778).
2. The new deadlines are inserted against the new `scan_id` (893–898).
3. **The old scan's `document_deadlines` rows are kept untouched.** They are not deleted (the FK cascades only when
   the scan row itself is deleted, A1) and not marked. There is **no `is_current`, no `superseded_by`, and no
   carry-over** on deadlines. Gaps, by contrast, are paired and closed as `superseded` (800–871).
4. **A calendar event already made from an old deadline stays.**
   - Its `document_id` still points at the document.
   - The old deadline keeps its `calendar_event_id`.
   - **The new reading's matching deadline has `calendar_event_id` null, so its report row offers "Add to calendar"
     again.** Pressing it makes a second event for the same date (`actions:136` checks only the row pressed).
5. **The report shows both readings' deadlines together** (`documents/report/route.ts:43`, no scan filter). Staging's
   one re-read document shows the same source line under two titles (C3). The person sees one obligation listed
   twice.
6. **The index's significant date also reads every reading.** `document_index_v`'s three lateral reads
   (`049:156–171`) filter `dd.document_id = d.id` with no scan condition. The view joins only the current scan for
   everything else (`049:98`). So an expiry read by an **older** reading can still be a permit's expiry date, and
   with it "Expired" / "Expiring" (`049:86–91`) (B3).

**When a newer version arrives:**
- `documents.version_of` on the **newer** row points at the older one, "The document this one supersedes, PROPOSED
  by the scan and confirmed by a person" (`040:33–38`, comment `040:43–45`).
- `version_confirmed` is set true when the person used "Add a newer version" (`app/documents/page.tsx:340–342`).
  The `version` action sets or clears it (`actions:169–182`).
- **There is no "is current version" column on `documents`.** Handbooks have one (`066:66`, `is_current`, and
  `lib/handbookDelete.ts:33–35` keeps it right). Documents do not.
- Both versions stay listed. `document_index_v` has one row per document, versions included (`049:96`, `from
  public.documents d`).
- `app/documents/page.tsx:464–468` counts `counts[r.version_of]++`, keyed by the **older** document's id. The row at
  583–590 shows it on that document as "N older version(s)". **Read literally, the label sits on the older document
  and says it has older versions.** **HYPOTHESIS**, because no document on staging has a version (C3). Settled by
  uploading a newer version on staging and reading the two rows. It is outside the Calendar and noted for
  Documents.
- **The deadlines of an older version are still read by everything:** the Audits index (`app/api/audits/index/route.ts:72–78`,
  `.in('scan_id', scanIds)` over every indexed document) and the audit reader (`lib/audit.ts:157`, `:175–177`).

**Can a query select only the current version's current deadlines? Yes, with what exists today:**
```sql
select dd.*
  from public.document_deadlines dd
  join public.document_scans s on s.id = dd.scan_id and s.is_current              -- the current READING
 where not exists (select 1 from public.documents newer                           -- the current VERSION
                    where newer.version_of = dd.document_id and newer.version_confirmed)
```
On staging: `→ current_deadlines 36 | documents 11`. That equals C3's `is_current = true` line, as it must with no
versions. Two things it cannot do:
- It treats an **unconfirmed** proposed version as not superseding. That is a choice, and the brief's guardrail
  decides it.
- It needs both joins **every time**. No view or column carries "current deadline", and three readers today use
  neither (B3).

### D4. Where dates would hook into summaries (map only)

- **The writer.** `lib/summaryReport.ts` `summariseTopic` (422–490):
  - The prompt is `summaryReportPrompt(today)`, or `hrSummaryPrompt(today)` for HR (446–447).
  - `checkReport` (454, defined 259–346).
  - The save is the guarded update of `topics.summary_report` and `summary` (456–466).
  - Then proposals: facts → `fact_proposals` through the service role, one at a time, a 23505 duplicate counted as
    already waiting (472–489).
  - Callers: `app/api/topics/[id]/summarise/route.ts`, `app/api/hr/topics/[id]/summarise/route.ts`, and the nightly
    `app/api/jobs/summarise/route.ts:124–129` (HR through `kind: 'hr'`, 129).
- **The shape.** `SummaryReport` (57–69): `title, as_of, situation, applies, to_confirm, unanswered, facts,
  facts_dropped?, sources`. There is **no `dates`**.
- **`checkReport` rebuilds the report field by field** (336–345). An extra `dates` array the model returned would be
  **silently dropped** unless `checkReport` learns it.
- **Storage.**
  - `topics.summary_report` is jsonb with one CHECK, that it is an object (`063:27–34`). A `dates` key inside it
    needs no migration.
  - A date a person sends to the calendar needs a back-link. `calendar_events` has `document_id` and `handbook_id`
    and nothing for a topic. Either a `topic_id` column (a migration), or the event stays unlinked as Audits' does
    today (B7).
- **The prompts.**
  - `prompts/summary-report.ts` (the workspace) and `prompts/hr-summary.ts` (HR, 33 lines).
  - HR's last two paragraphs are copied word for word from the workspace's rule 7 and its facts paragraph
    (`hr-summary.ts:9–11`).
  - `tests/unit/hrSummary.test.ts:80–90` pins that (`p.includes(… situation + '\n\n' + facts)`,
    `p.endsWith(facts)`), and `:114–120` pins the empty-situation sentence in both.
  - **Adding a dates paragraph after the facts paragraph would fail `p.endsWith(facts)` (:89).** It has to go before
    it, or the test changes with the owner's say-so.
  - Any prompt edit is a §3.1 quality change.
- **The drawer.**
  - `components/ReportView.tsx` (176 lines) draws: what applies (120–143), Still to confirm (144–149), Asked and not
    answered (150–157), the facts line (158), and Sources (159–173).
  - A "Dates" section would sit beside `to_confirm`, in the same `<section>` / heading shape.
  - Its users are `app/compliance/page.tsx:58` and `app/hr/HrWorkspace.tsx:43` (`:961`). HR's drawer already passes
    a `printDates` prop (`HrWorkspace.tsx:932`; it is the print header's date, not calendar dates).
- **The checks that could verify each source line:**
  - **`checkCitations` (210–225):** a `basis` of 8+ normalised characters must appear in one paragraph of an
    **assistant** answer, and only that paragraph's source markers are kept. This fits a date the answer stated
    ("by 1 July 2027 [3]").
  - **The B3 facts check (310–321):** a quote must appear in one of the **person's** messages
    (`normaliseForMatch`/`quoteKey`, 182–191). This fits a date the person stated ("our permit renews in March").
  - **`verifyQuote` (`lib/documentScan.ts:196`):** checks a quote against a document's stored `extracted_text`.
    This fits a date read from an attached document, and is **the check Documents' own deadlines do not get today**
    (B16).

### D5. Email (item 5)

**The pattern to copy** is `lib/auditNotify.ts` and its copies `lib/handbookCheckNotify.ts` and `lib/documentBatch.ts`.
- **Plain text**, through Resend (`auditNotify.ts:15`, `:184–191`).
- **The sender in code is `CompliBoard <onboarding@resend.dev>`.** It appears four times: `auditNotify.ts:186`,
  `handbookCheckNotify.ts:103`, `documentBatch.ts:215`, `app/api/feedback/route.ts:11`.
- **`NEXT_PUBLIC_APP_URL` or nothing is sent.** Without it the email is refused and logged ("a wrong link is worse
  than no email", `auditNotify.ts:160–172`, `documentBatch.ts:154–168`, `:200–203`).
- **`NOTIFY_TEST_TO` overrides the recipient**, and the body says at the top where it was really addressed
  (`documentBatch.ts:140–145`, `auditNotify.ts:90`).
- **`notified_at` is set only after a send that succeeded**, by compare-and-set
  (`.is('notified_at', null)`, `auditNotify.ts:192–193`, `handbookCheckNotify.ts:106`). The worst case is a
  duplicate, never silence.
- **Recipient.** The login that started the thing, read from `auth.users` through the service-role admin API,
  because `profiles` has no email (`auditNotify.ts:69–86`). HR sends nothing when no person pressed
  (`handbookCheckNotify.ts:48`).
- **Cron.** `vercel.json:3–8` holds six routes, all under `/api/jobs/`, with no calendar job.
  - Each is guarded by `requireCronSecret` (`lib/jobAuth.ts:31–46`): GET with Bearer for Vercel, POST with
    `x-cron-secret` by hand, every refusal a 404.
  - Each run writes a `job_runs` row opened before the work (`jobAuth.ts:48–80`).
  - **`job_runs.job` is a CHECK list** (`066:324–326`: `summarise, delete, account_delete, scan_documents,
    audit_sections, handbook_checks`), and `startJobRun`'s type matches it (`jobAuth.ts:66`). **A monthly calendar
    job needs a migration to add its name.**

**Who at a company it would go to: there is no answer in the schema.**
- `profiles` is `id, company_id, full_name, created_at` (`000:290–295`), with no later column. `companies` has no
  contact email (`000`, the `companies` definition). There are no roles (`HR-PLAN.md` decision 31: "They wait for
  user roles").
- The existing emails answer "the person who pressed". A monthly digest has nobody who pressed.
- **So the recipient is a product decision** (B11): every login at the company, the signup login, or a new
  per-person opt-in.

**The sender domain.**
- Code sends from `onboarding@resend.dev`, which is **not a CompliBoard domain**.
- `docs/HANDOFF-CODE.md:531–535` and `docs/HANDOFF-AUDITS.md:514–517`: the audit email "arrived and went to junk"
  because DNS for the sending domain is not set up. The send itself was accepted ("a DNS job, not a code job").
- **HYPOTHESIS**, from Resend's general behaviour and not from this repository: the `resend.dev` test sender only
  delivers to the Resend account's own address. That would make a monthly email reach customers only after a
  domain is verified. Settled by reading the Resend dashboard, not the code (`CLAUDE.md` §3.4a's lesson about
  facts that live in a dashboard).

---

## PART E — B-items

**B1.** The done tick has not saved since 9 September 2026. `page:234–238` sends no token. `route:99` answers 401
(2a, output printed). The UI shows it done until reload. `STATUS.md:229` says "working".

**B2.** `new Date('YYYY-MM-DD')` is read as UTC midnight at `page:262`, `:272`, `:278`, `dash:113`, `:117`.
- In Oregon, a date due today is "Overdue" in the banner and missing from the dashboard's 30 days.
- A 1st-of-month date is listed under the previous month.
- (2b, output printed.) `page:513` already has the correct form.

**B3.** **Nothing marks a deadline as current.**
- Re-reads keep the old reading's `document_deadlines` (`lib/documentScan.ts:744`, `:893–898`).
- Three readers mix readings: the report (`documents/report/route.ts:43`), and the index view's significant date
  (`049:156–171`, which drives Expired/Expiring).
- The Audits readers filter by **current scan** but not by **current version** (`audits/index/route.ts:72–78`,
  `lib/audit.ts:175–177`).
- The current-only query exists (D3) and nothing uses it.

**B4.** **Recurrence is a label.**
- Nothing creates a next occurrence (2c, the greps).
- Every recurring deadline is sent as "annually": `actions:144`, the parked HR route `:44`, and the import prompt
  `prompts/extract-dates.ts:32`.
- The only recurring deadlines staging holds are monthly (C3).

**B5.** The dashboard's upcoming list does not exclude completed events (`dash:113`).

**B6.** `/api/extract-dates` is unanchored and unvalidated.
- It enumerates "any important dates", up to 10, with no source line (`prompts/extract-dates.ts:6–35`).
- It returns unvalidated JSON (`extract-dates:72`).
- It is told "future" with no today (`:57–60`, HYPOTHESIS on effect).
- It stores no file and no `document_id` (`page:203–214`).
- `docs/TODO.md` M5 already names it the mode to retire.

**B7.** Audits' "Add to calendar" is a navigation with the title and date only.
- No document, no audit, no finding id (`AuditReport.tsx:1052`, `page:132–139`).
- Twice makes two rows (2d).
- The finding cannot show "In your calendar".
- `calendar_events` has no column for an audit or a topic.

**B8.** Documents' `deadline_to_calendar` checks then inserts (`actions:136`, `:140`). Two crossing presses insert
twice. The compare-and-set fix exists on the parked HR route
(`parked/hr-check-structured:…/calendar/route.ts:49–57`).

**B9.** `calendar_events` has no CHECK and no unique key (A1, read from staging).
- `category` holds `compliance` (import, `page:210`; all 47 production rows on the day 006 was written), `document`
  (`actions:143`), `hr` (parked route), a dropdown value (`page:20–23`), or null.
- `006:66–71` records that the stored and offered sets are disjoint.

**B10.** `calendar_events.user_id` is ON DELETE CASCADE to `auth.users` (`000:364`, read back). Removing a colleague's
login deletes the company's calendar events that person added.

**B11.** **There is no address for a company-level email.**
- No role, no company contact (`000:290–295`, `companies`).
- Every existing email goes to "the person who pressed".
- This is a product decision.

**B12.** The calendar cannot say where a date came from.
- `CalendarEvent` has no `document_id`/`handbook_id`/`entity_id` (`page:8–18`).
- `description`, which holds a deadline's source line (`actions:142`), is never drawn (A3).

**B13.** `calendar_events.entity_id` exists (`009:98–99`) and only the parked HR route writes it.
- Documents' button does not (`actions:140–146`), though the document has a site.
- The page cannot filter by site.

**B14.** The import's add loop reports "Added N dates" with N = dates picked, whether or not each POST succeeded
(`page:202–218`).

**B15.** Text that promises what does not exist:
- `page:283` and `:504`: "click Extract dates … add them to your calendar automatically".
- `app/page.tsx:84` "Every deadline appears on your compliance calendar automatically", `:85` "Monthly summaries and
  alerts before anything expires or comes due", `:89` "Get alerted before anything expires", `:93` "Add to Google Calendar or Outlook in one click".
- `app/account/page.tsx:390` and `:421` "Deadline reminders".
- No reminder or alert exists (2c's greps and `vercel.json`).
- `CLAUDE.md` §5.1 and §6 apply.

**B16.** A deadline's `source_line` is not checked against the document (`lib/documentScan.ts:344` against `:335`,
`:351`, `:682`), while its gaps and facts are. `verifyQuote` (`:196`) is the check that would do it.

**B17.** `check:live` never touches `calendar_events` or `/api/calendar` (A10). No unit test covers the page's date
arithmetic. The 401 in B1 and the day in B2 had no instrument.

**B18.** **Production's calendar was not read** (C2-prod: the session's permission system refused). The only figure is
47 rows, all `compliance`, from `003:48–53` and `006:66–67`. What happens to old rows (`TODO.md` M5, last item)
cannot be sized from this step.

---

## Facts and hypotheses

| Claim | Status | Settled by |
|---|---|---|
| The tick does not save | **Fact** (2a) | — |
| The day is off in Oregon | **Fact** (2b) | — |
| Nothing makes a next occurrence | **Fact** (2c) | — |
| Audits' events carry no source; twice is two rows | **Fact from the code path** (2d) | A click on staging, if wanted |
| Re-reads keep old deadlines and the report shows both | **Fact** (code + C3) | — |
| The index's expiry can come from an older reading | **Fact from the view text** (`049:156–171`) | A fixture with an expiry only in the older reading |
| The model judges "future" with no today | **HYPOTHESIS** | One Haiku call with a fixture |
| "N older versions" sits on the wrong row | **HYPOTHESIS** | One newer version uploaded on staging |
| `resend.dev` delivers only to the account owner | **HYPOTHESIS** | The Resend dashboard |
| Export leaves out deadlines on purpose | **HYPOTHESIS** | The owner |
| Production's calendar contents | **Not known** | The command in C2-prod |

## What I could not see, and why

- **Production's `calendar_events`.** The read was refused by this session's permission system (C2-prod).
- **A re-read with a dated deadline sent to the calendar.** Staging's one re-read document has only undated
  deadlines and nothing sent (C3), so the duplicate "Add to calendar" is shown from the code and the report query,
  not from a row.
- **A document with a newer version.** Staging has none (C3).

## Effects on other sections, by file

**None beyond this file.** The step added `docs/CALENDAR-MACHINERY.md` and changed nothing else in the repository.

Two things touched staging data and were put back:
- The probe event `0b7413a4…` was created and deleted through `/api/calendar` (2a). Test Alpha's calendar holds
  0 rows, as before.
- Nothing else was written. Every other staging statement was a `select`.

The isolated server copy is deleted.

Noted for other sections, not changed:
- **Documents:** B3, B8, B16, and D3's version label.
- **Audits:** B7.
- **HR:** the parked route's `'annually'` (B4).
- **Dashboard:** B2, B5.
- **Landing and account pages:** B15.
