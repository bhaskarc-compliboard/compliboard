# DASHBOARD — THE MACHINERY, READ FROM THE CODE

**Version 1.0 — 19 October 2026.** Dashboard step 1, the read-only map. Nothing was changed; the
only file this job wrote is this one.

**How to read it.** Every fact carries a `file:line` or a `table.column`. Anything not carried that
way is marked **(judgement)** or **(hypothesis)**. Staging numbers were read on 19 October 2026
through the Supabase CLI's own database connection against ref `amzsavsrabrlcprltpom` — **not the
service role**, and `SELECT` only. The exact SQL is printed beside every number.

- `npm run cost` at the start: **$3.24, 61 calls**. At the end: **$3.24, 61 calls**. No model call
  was made (the one browser run was `npm run measure`, which printed `BLOCKED (0)`).
- The two companies throughout: **Test Gamma Solvents** `7e61edca-e1d7-4a30-96ca-784c66b49fc2`
  (`testgamma@example.com`, named in `docs/CALENDAR-MACHINERY.md:44`) and **Cascade Specialty
  Chemicals, LLC** `95f7167d-1d3f-4004-bb44-dde80d0d4262` (`testcascade@example.com`).
  *`docs/CALENDAR-MACHINERY.md:59` says Cascade "has no fixture login". That is now out of date —
  Cascade has one `profiles` row, and `npm run measure --as testcascade@example.com` signed in.*
- **Production was not read.** `SUPABASE_PROD_SERVICE_ROLE_KEY` is present and blank (§3.8), and
  the Calendar's step 14 did not query production either — `docs/CALENDAR-MACHINERY.md:1268`:
  *"Production was not queried."* So there is no step-14 path to reuse, and this job skipped it.

---

## A. WHERE A PERSON LANDS, AND WHAT THE DASHBOARD IS TODAY

### A1. After login a person lands on the MARKETING HOMEPAGE, not the Dashboard

Every hop, read from the code. There is **no middleware** (`find . -maxdepth 3 -name middleware.ts`
→ none) and **no redirect in `next.config.ts`** (the file is the create-next-app stub, 7 lines).

| Hop | File:line | Destination |
|---|---|---|
| Sign in succeeds | `app/login/page.tsx:29` | `router.push('/')` |
| Sign up succeeds | `app/signup/page.tsx:193` and `:203` | `router.push('/')` |
| Password reset succeeds | `app/reset-password/page.tsx:46` | `router.push('/dashboard')` — the **only** push to it |
| Log out | `components/AppLayout.tsx:163` | `router.push('/login')` |
| The logo in the signed-in header | `components/AppLayout.tsx:268` | `<a href="/dashboard">` |
| First sidebar item | `components/AppLayout.tsx:40` | `{ label: 'Dashboard', href: '/dashboard' }` |

**`/` is `app/page.tsx`, and it does not know whether anybody is signed in.** It is 317 lines of
marketing: a hero, four product sections, a price block and a footer. It reads no session
(`grep -n "supabase\|auth" app/page.tsx` → nothing), and its nav at `app/page.tsx:18` and `:19`
offers **"Sign in"** and **"Start free trial →"** to a person who has just signed in. There is no
link from it to `/dashboard`.

> **So the Dashboard is reached only by clicking the sidebar or the logo, and a person who has just
> signed in is shown the sales page with a Sign in button on it.** The one path that lands on
> `/dashboard` is the password-reset flow.

The Dashboard guards itself: `app/dashboard/page.tsx:78` — `if (!user) { router.push('/login') }`.
That is a UX affordance, not the boundary (§3.6); RLS is.

### A2. Every read the page makes

One file: **`app/dashboard/page.tsx`** (287 lines, `'use client'`). One component:
**`components/AppLayout.tsx`**, at `:158` (loading) and `:167` (loaded), both `title="Dashboard"`.
Three library imports, no others: `lib/documentStatus` (`isAmber`, `statusWord`),
`lib/calendarCounts` (`liveDates`, `CALENDAR_COUNT_COLUMNS`), `lib/calendarView` (`NOT_CONFIRMED`).

All five reads go through `createClient()` — **the caller's own client, so RLS scopes them**.

| # | Line | Relation | Columns | Filter | Order | Limit |
|---|---|---|---|---|---|---|
| 1 | `:81` | `profiles` | `company_id` | `.eq('id', user.id)` | — | `.single()` |
| 2 | `:86` | `companies` | `name, industry, state, city` | `.eq('id', companyId)` | — | `.single()` |
| 3 | `:97` | `calendar_v` (view) | `id, status, next_due, has_passed, title, days_until` | `status in ('proposed','confirmed')` **and** `replaced_by is null` — built by `liveDates()`, `lib/calendarCounts.ts:49` | none in SQL; sorted in the browser at `:154` by `next_due` | none |
| 4 | `:120` | `document_index_v` (view) | `document_id, title, file_name, kind, display_status, document_status, scanned_at, open_gap_count` | `.eq('company_id', companyId)` **and** `.not('scanned_at','is',null)` | `scanned_at` desc | none in SQL; `.slice(0,5)` at `:130` |
| 5 | `:125` | `checklists` | `research_answer` | `.eq('company_id', companyId)` | — | none |

Read 3 names no company: `calendar_v` is `security_invoker` and RLS decides. Read 4 names one
anyway, which is belt and braces, not a defect.

Two columns are fetched and never used: `document_status` and `kind`'s companion — `document_status`
is selected at `:121`, declared on the interface at `:56`, and read by nothing in the file except
`isAmber(r)` (`lib/documentStatus.ts:62` onward), which does use it. So nothing is dead.

### A3. The panels in the order they appear, with their exact words

1. **Loading** (`:158–163`) — `Loading...`
2. **The company header** (`:171–180`) — `{company.name}` as an `h1`, then `industry · state · city`
   as grey chips. Cascade draws `Cascade Specialty Chemicals, LLC` / `chemical-manufacturing ·
   Oregon · Portland`. **The industry is printed as the raw slug**, hyphen and all.
3. **Four tiles** (`:183–195`), a `grid-cols-2 lg:grid-cols-4`, labels uppercase 12px, values 24px
   semibold grey-700. The labels, exactly: **`Files reviewed`** `:185` · **`Issues identified`**
   `:186` · **`Questions answered`** `:187` · **`Checklists created`** `:188`. No tile is a link and
   none has an empty state — a zero is drawn as `0`.
4. **`Recently read`** (`:201`), with **`All documents`** at `:204` linking `/documents`, shown only
   when `readings.length > 0` (`:202`).
   - Empty state `:216`: **`No documents read yet.`** then **`Add files`** (`:218`) to `/documents`.
   - Each row (`:224–236`) is an `<a href="/documents">` — **every row goes to the same place; a row
     does not open its own document.** Line 1 is `title || file_name`; line 2 is the kind word then
     `· read 15 Oct 2026`; the right-hand word is `statusWord(r)`, amber when `isAmber(r)`.
5. **`Upcoming — next 30 days`** (`:243`), orange-600.
   - Read failed (`:247`): **`We could not load your dates just now. Nothing has changed — open the
     Calendar to see them.`** — §5.1, and it is reached before the empty state (`:245` precedes
     `:251`), so "no dates" is never drawn over a failure.
   - Empty (`:253`): **`No deadlines in the next 30 days.`**
   - Each row (`:263`) is an `<a href="/calendar?tab=calendar&date=${e.id}">`; a `proposed` row
     carries **`not confirmed`** (`:271`, `NOT_CONFIRMED` from `lib/calendarView.ts:191`); the pill
     reads **`Today`** / **`Tomorrow`** / **`in N days`** (`:275`), red when `days_until <= 7`.

There is no coverage strip (§6), no audits panel, no requirements panel and no questions panel.

### A4. What the page reads that no longer matches

`npm run check:schema` passes — *"check-schema-contracts: ok — 311 files, 58 relations (53 tables +
5 views)"* — so **no column the Dashboard names is gone.** What follows is not a broken column; it
is five places where the page disagrees with the current rules or with itself.

1. **`Questions answered` counts the wrong thing, and it reads 0 on a company that has asked 31.**
   `app/dashboard/page.tsx:137` — `checklists.filter(c => c.research_answer).length`. A checklist row
   whose `research_answer` is non-null is a **research answer stored on a checklist**, not a question
   answered. `usage_counters.questions_answered` exists for exactly this number (migration 032) and
   **the Dashboard does not read it.** Measured, §B4: Gamma's counter is **31**, the tile shows
   **0**; Cascade's tile shows **0** and Cascade has no counter row at all.
2. **`Checklists created` counts checklists WITHOUT a research answer** (`:138`,
   `!c.research_answer`), so the two tiles split one table between them and neither is its own name.
   `usage_counters.checklists_created` is **5** for Gamma against the tile's **3**.
3. **Both of those numbers can go DOWN, and the counters cannot.** Migration 032's own comment,
   `032_usage_counters.sql:14`: *"COUNTERS NEVER GO DOWN, AND ARE NEVER DERIVED FROM ROWS THAT CAN BE
   DELETED."* The Dashboard derives both from `checklists`, which a person can delete. Gamma's
   counter/row gap (5 vs 3) **is that rule working, and the tile is on the wrong side of it.**
4. **A duplicated display map, and a stale pointer to it.** `app/dashboard/page.tsx:61–64` carries
   its own `KIND_WORD`, while `lib/documentStatus.ts:52` exports one. `lib/documentStatus.ts:43`
   names the copy as *"`app/dashboard/page.tsx:37`"* — **it is at `:61` today**, so the cross
   reference is stale. The words themselves agree (both say `Supplier document`); `AuditReport.tsx:41`
   is the one that says `Supplier's document`.
5. **It is the only signed-in page not on the shared 900 column, and not in the print frame.**
   `:168` is `p-6 max-w-5xl mx-auto` (1024px) and there is no `.print-page` div — `npm run measure`
   printed `column box   no .print-page`. §A5 has the numbers; `lib/printFrame.ts` has five importers
   and the Dashboard is not one.

**What is NOT wrong, checked and cleared:**

- **The calendar read is current.** It goes through `liveDates` (`:97`), the one filter the tab
  counts, the badge, the feed and the monthly email share — Calendar step 12 moved it off
  `/api/calendar`, and `tests/unit/calendarShell.test.ts:486–494` fails if it moves back. `withdrawn`
  rows are not in `calendar_v` at all (migration 075); `dismissed` and superseded ones are filtered.
  Nothing in the file does date arithmetic: `next_due`, `days_until` and `has_passed` are the view's.
- **`open_gap_count` is `document_gaps` where `status='open'` for that document**, from the view's
  own definition (`pg_get_viewdef('public.document_index_v')`, the last LATERAL). It does **not**
  exclude a gap a later reading passed over — but that is deliberate, not a leak:
  `lib/documentScan.ts:875–885` sets `not_seen_at` and leaves the row open, *"a reading that failed to
  mention a missing evacuation procedure is not evidence that the procedure now exists."* A gap a new
  reading replaced is set to `status='superseded'` (`lib/documentScan.ts:871`) and drops out.
  Verified on staging: all 31 gaps are `open`, from the current scan, none superseded, none not-seen —
  so staging cannot demonstrate the distinction either way, and this paragraph rests on the view's SQL
  and `documentScan.ts`, not on a count.

### A5. The measurements and the screenshots

`npm run measure` at 1280×900 against an isolated server on port 3997 (the §3c copy, started under
`node scripts/haiku.mjs npx next dev -p 3997` — the guard printed **`haiku check: 13 of 13 tiers on
claude-haiku-4-5`** before the server started, and the copy was deleted afterwards). **Every run
printed `BLOCKED (0): nothing — no paid route and no write was attempted`.**

| Run | Title x | Column | Footer text | Screenshot |
|---|---|---|---|---|
| `/dashboard` as `testgamma` (no scrollbar) | **264** | `no .print-page` | 326 | `shots/dashboard-today-testgamma.png` |
| `/dashboard` as `testcascade` (15px scrollbar) | **257** | `no .print-page` | 319 | `shots/dashboard-today-testcascade.png` |
| `/hr` as `testgamma` | **326** | 302–1202 (900) | 326 | — |
| `/calendar` as `testgamma` | **326** | 302–1202 (900) | 326 | — |

**The brief's figure is confirmed, and the comparison it quotes needs correcting.**
`docs/HANDOFF-WORKSPACE.md:546–549` records `/calendar` and `/hr` with **title x=248** and footer 326.
Measured today they are both at **326** — those two pages have since been moved onto the shared 900
column, and §7's table is out of date for them. So the Dashboard's 264 now stands against **326 on
every other shell page**, which is what the brief says, by a different route than the §7 table shows.

The arithmetic, so the 264 is not a magic number: the sidebar is `w-56` = 224px
(`components/AppLayout.tsx:316`). A 900 column centred in the remaining 1056 starts at 302, plus the
24px inner padding = **326**. The Dashboard's `max-w-5xl` is 1024, centred in 1056 → 240, plus `p-6`
= **264**. The 257/319 pair is the same page with a 15px scrollbar taking 7px off each.

**What the screenshots show**, and it matches the queries in §B4 exactly:

- Gamma: tiles **3 · 6 · 0 · 3**. Three readings, one amber (`Needs work`). One upcoming date,
  `test date`, `in 2 days`. Sidebar: `Company information 5`, no Calendar badge.
- Cascade: tiles **12 · 25 · 0 · 0**. Five readings listed. Three upcoming dates, all `not confirmed`.
  Sidebar: `Company information 15`, `Calendar 37`.

### A6. Every test that touches the Dashboard

**One file, `tests/unit/calendarShell.test.ts`, five assertions' worth.** `grep -rln "[Dd]ashboard"
tests/` returns that file and nothing else.

| Line | Test | What it holds |
|---|---|---|
| `:454` | *(inside the extract-dates test)* | `app/dashboard/page.tsx` must not call the deleted `extract-dates` prompt |
| `:486` | `through the one shared filter, not a query of its own and not the route` | the exact `liveDates(...)` call; no `fetch('/api/calendar')`; never `.from('calendar_events')` |
| `:502` | `a date with no computable day is not a deadline, and a passed one is not upcoming` | the `next_due && !has_passed` and `days_until` filter; no `new Date(e.due_date)` |
| `:509` | `an unconfirmed date is marked … and every row opens the date` | `status === 'proposed'`, `NOT_CONFIRMED`, the `/calendar?tab=calendar&date=` href |
| `:515` | `a read that failed is not an empty calendar (§5.1)` | `setEvents(null)`, the sentence, and that the failure branch precedes the empty branch |

> **Every one of them is about the calendar panel. Not one test touches the four tiles, the readings
> list, the empty states or the company header.** The tiles are the part of the page with no cover at
> all, and §B shows they are also the part that is wrong.

---

## B. THE FIVE NUMBERS — WHAT THE CODE CAN COUNT TODAY

### B1. The usage counters, and every increment site

**The table — `public.usage_counters`, migration `032_usage_counters.sql:27–33`:**

| Column | Type |
|---|---|
| `company_id` | uuid, **primary key**, → `companies` on delete cascade |
| `questions_answered` | integer not null default 0, `check (>= 0)` |
| `checklists_created` | integer not null default 0, `check (>= 0)` |
| `created_at`, `updated_at` | timestamptz |

Two columns, not five. There is **no** counter for files, issues or audits.

Grants (`032:60–63`): `anon` nothing, `authenticated` **SELECT only**, `service_role` all. The
increment is `public.increment_usage_counter(uuid, text)` (migration `035`), `service_role` EXECUTE
only, one atomic `set x = x + 1` statement — PostgREST cannot express that, and a read-modify-write
in a route loses an event when two answers land together (`035:7–10`).

**Every increment site in the code.** The wrapper is `bumpCounter`, `lib/conversation.ts:184–197`
(seeds the row on 23505, then `rpc('increment_usage_counter')`). Five call sites, no others —
`grep -rn "bumpCounter\|increment_usage_counter" app lib components scripts tests`:

| # | File:line | Counter | The event |
|---|---|---|---|
| 1 | `app/api/chat/route.ts:439` | `checklists_created` | a checklist and its items are both saved — *"The counter moves only for a checklist that now exists"* (`:438`) |
| 2 | `app/api/chat/route.ts:507` | `questions_answered` | the research stream reaches `ev.type === 'done'` — *"THE COUNTER MOVES HERE AND NOWHERE ELSE — on a completed stream"* (`:505`) |
| 3 | `app/api/checklists/from-topic/route.ts:272` | `checklists_created` | a conversation converted: the checklist row and its items are inserted |
| 4 | `app/api/hr/answer/route.ts:249` | `questions_answered` | an HR answer stream completes — *"Decision 9: an HR answer counts as an answered question"* (`:248`) |
| 5 | `lib/ask/engine.ts:220` | `questions_answered` | **the shared ask engine's** stream completes, after the turn is saved |

Every one is inside a `try/catch` that logs and swallows: a counter that fails never fails the answer.

### B2. The five numbers, one at a time

**1. Files reviewed.**
- *Source today:* `app/dashboard/page.tsx:135` — rows of `document_index_v` with `scanned_at not null`
  and `display_status <> 'could_not_read'`. Same definition `lib/documentBatch.ts` uses for the batch
  email, so the two cannot disagree.
- *Can it go down?* **Yes.** Delete a document and the row goes. A re-read replaces a reading rather
  than adding one, so a document read twice still counts once — honest, and also means the number is
  *documents with a reading*, not *readings performed*.
- *Not counted:* a file that could not be opened; a file uploaded and not yet read.

**2. Issues identified.** §B3 — the candidates, not a decision.

**3. Questions answered.** This is the one the brief asks to check event by event.
- *Source today:* `app/dashboard/page.tsx:137`, `checklists.research_answer is not null`. **Wrong
  thing, 0 on both companies, §A4.1.**
- *What `usage_counters.questions_answered` would give,* each checked from the code:

| Event | Does it bump? | Evidence |
|---|---|---|
| The Compliance Workspace's research answer | **yes** | `app/api/chat/route.ts:507` |
| **An answer from the shared ask engine (`lib/ask`)** | **YES** | `lib/ask/engine.ts:220`, in `answer()` |
| **The Calendar's answer** | **YES — through that engine** | `app/api/calendar/answer/route.ts:18` imports `answer` from `@/lib/ask/engine`; the bump is the engine's, not the route's |
| **HR's answer** | **yes** | `app/api/hr/answer/route.ts:249` |
| **"How do I do this?"** | **no** | `grep bumpCounter app/api/checklist-items/[id]/how-to/route.ts` → **no increment found**. Migration `032:21–22` names micro-steps as a deliberate exclusion: they expand an item of a checklist already counted |
| **A summary** | **no** | no increment in `app/api/topics/[id]/summarise/route.ts`, `app/api/hr/topics/[id]/summarise/route.ts` or `app/api/calendar/topics/[id]/summarise/route.ts` |
| **A stopped answer** | **no, deliberately** | the bump sits inside the `done` branch at all three stream sites; `lib/ask/engine.ts:223` treats an abort as *"stopped by the person"* and marks the turn stopped at `:237` instead. Migration `032:20` names it. **Proved by a probe**: `scripts/check-live.js:996` fails the run if a stopped answer moves the counter |
| A document scan | no | no increment in `app/api/document-scan/route.ts` |
| An audit run | no | no increment in `app/api/audit-runs/route.ts` |
| A checklist from a document gap | **no — and the file says it does** | `app/api/document-checklist/route.ts:8` claims *"same `checklists_created` counter"*; `grep bumpCounter` on that file → **no increment found**. A checklist made from a gap is not counted. **This is a real hole, found here.** |

- *Can it go down?* **No** — `check (questions_answered >= 0)`, `authenticated` holds no UPDATE, and
  the function only ever adds one.
- *Not counted that a person might expect:* micro-steps, summaries, gap checklists, and anything
  that happened before a company's first increment created its row (Cascade has **no row at all**).

**4. Audits done.**
- *Source today:* **nothing on the Dashboard reads audits at all.**
- *What the code could read:* `select count(*) from audit_runs where company_id = ? and status =
  'done'`. The three values are fixed by
  `supabase/migrations/058_the_audit_as_rows.sql:70` — `check (status in ('queued','running','done'))`.
  A dismissed run keeps `status='done'` and gains `dismissed_at`, so whether a dismissed audit still
  counts as *done* is a product decision, not a code one. **(judgement)** I would count it: it was
  done; dismissing it is about the report, not the work.
- *Can it go down?* **Yes** — a deleted run removes the row.

**5. Checklists created.**
- *Source today:* `app/dashboard/page.tsx:138`, `checklists.research_answer is null`. §A4.2.
- *Counter:* `usage_counters.checklists_created`, bumped at sites 1 and 3 above, **not** by the
  document-gap route.
- *Can it go down?* The counter, no. The current tile, yes.

### B3. "Issues identified" — the candidates, with staging counts

Three things in this codebase are called a finding, a gap or an issue. **Not a decision — the list.**

| Candidate | Table | Status values | Filter that means "open" | Gamma | Cascade |
|---|---|---|---|---|---|
| **Document scan gaps** *(what the tile uses today)* | `document_gaps` | `open`, `dismissed`, `superseded` | `status='open'`, already applied by `document_index_v`'s `open_gap_count` | **6** | **25** |
| **Audit findings** | `audit_findings` | `open`, `closed`, `dismissed` (`058:192`) | `status='open'` | **34** | **0** |
| Document gaps, every row regardless of status | `document_gaps` | — | none | 6 | 25 |
| Audit findings, every row | `audit_findings` | — | none | 36 | 0 |

A fourth thing exists and is **not** an issue: `critic_findings`, which is the critic pass's record
of what it thought of an answer (`CRITIC-PASS.md`), closed to `authenticated` entirely. It is not a
compliance problem and does not belong in this number.

> **The tile today adds up gaps and ignores findings.** Gamma has **34 open audit findings and the
> tile says 6.** Cascade has 25 gaps and no audit at all. **(judgement)** The honest number is
> `open gaps + open audit findings`, and the two companies are a good argument for it: each one
> exercises exactly one of the two sources, so a tile reading only one source is wrong for one of
> them and right for the other, which is the worst possible way to be wrong.

### B4. All five candidates on staging, both companies

**The query, exactly as run** (CLI DB connection, ref `amzsavsrabrlcprltpom`, `SELECT` only):

```sql
with co as (
  select id, name from public.companies
   where id in ('7e61edca-e1d7-4a30-96ca-784c66b49fc2','95f7167d-1d3f-4004-bb44-dde80d0d4262')
)
select co.name,
 (select count(*) from public.document_index_v v where v.company_id=co.id and v.scanned_at is not null
    and v.display_status <> 'could_not_read')                                as dash_files_reviewed,
 (select coalesce(sum(v.open_gap_count),0) from public.document_index_v v
   where v.company_id=co.id and v.scanned_at is not null)                    as dash_issues_identified,
 (select count(*) from public.document_gaps g where g.company_id=co.id and g.status='open') as gaps_open,
 (select count(*) from public.audit_findings f where f.company_id=co.id and f.status='open') as findings_open,
 (select count(*) from public.audit_runs r where r.company_id=co.id and r.status='done')     as audit_runs_done,
 (select count(*) from public.checklists k where k.company_id=co.id)                         as checklists_rows,
 (select count(*) from public.checklists k where k.company_id=co.id and k.research_answer is not null)
                                                                             as dash_questions_answered,
 (select count(*) from public.checklists k where k.company_id=co.id and k.research_answer is null)
                                                                             as dash_checklists_created,
 (select coalesce(u.questions_answered,0) from public.usage_counters u where u.company_id=co.id)
                                                                             as ctr_questions_answered,
 (select coalesce(u.checklists_created,0) from public.usage_counters u where u.company_id=co.id)
                                                                             as ctr_checklists_created
from co order by co.name;
```

| The number | Source | **Test Gamma** | **Cascade** |
|---|---|---|---|
| **Files reviewed** | the tile today | **3** | **12** |
| **Issues identified** — gaps only | the tile today | **6** | **25** |
| **Issues identified** — open audit findings | `audit_findings` | **34** | **0** |
| **Issues identified** — gaps + findings | both | **40** | **25** |
| **Questions answered** — the tile today | `checklists.research_answer not null` | **0** | **0** |
| **Questions answered** — the counter | `usage_counters` | **31** | **(no row)** |
| **Audits done** | `audit_runs status='done'` | **5** | **0** |
| **Checklists created** — the tile today | `checklists.research_answer is null` | **3** | **0** |
| **Checklists created** — the counter | `usage_counters` | **5** | **(no row)** |
| *(context)* `checklists` rows in all | | 3 | 0 |

**The screenshots agree with the first, second, fifth and eighth rows exactly** — Gamma `3 · 6 · 0 ·
3`, Cascade `12 · 25 · 0 · 0`. That is the evidence that the queries and the page are reading the
same thing.

**Three things this table says out loud:**

1. **Cascade has no `usage_counters` row.** `bumpCounter` creates it on first increment
   (`lib/conversation.ts:188–190`) and Cascade has never completed an answer or made a checklist
   through a route. So a counter-based tile must render a missing row as **0**, not as blank or as an
   error — and a `coalesce` is the whole of it.
2. **Gamma's counter is 5 and its `checklists` rows are 3.** Two were deleted. That is migration
   032's rule working exactly as written, and it is the argument for the counter over the row count.
3. **"Questions answered" is 0 on both companies today, and 31 on one of them in the counter.**
   Of the five numbers, this is the one the owner's Dashboard would get most wrong today.

---

## C. UPCOMING DATES

### C1. How the Dashboard reads the calendar

`app/dashboard/page.tsx:97`:

```ts
const { data: cal, error: calError } = await liveDates(supabase, `${CALENDAR_COUNT_COLUMNS}, title, days_until`)
```

- **The view:** `calendar_v`, `security_invoker` — RLS decides the company and the page names none.
- **The filter:** `liveDates`, `lib/calendarCounts.ts:49–53` — `.in('status', ['proposed','confirmed'])`
  and `.is('replaced_by', null)`. **Yes, it is `liveDates` from `lib/calendarCounts.ts`**, the same
  function behind the Calendar tab's count, the Dates-to-confirm count, the sidebar badge, the feed
  and the monthly email. A `withdrawn` row never reaches it (migration 075 keeps them out of the view).
- **The columns:** `CALENDAR_COUNT_COLUMNS` (`lib/calendarCounts.ts:35`) = `id, status, next_due,
  has_passed`, plus `title` and `days_until` for the rows.
- **The limit:** **none in SQL.** Every live date is fetched and the narrowing happens in the browser.
- **The order:** **none in SQL.** `:154` sorts by `next_due` after filtering.
- **The 30-day window,** `:152–153`: `next_due` non-null **and** `!has_passed` **and** `days_until`
  between 0 and 30 inclusive. All three numbers are the view's, computed against the server's
  `current_date` — nothing in the file reads a browser clock, and `tests/unit/calendarShell.test.ts:505`
  fails if `new Date(e.due_date)` comes back.
- **A failed read is not an empty calendar:** `:104` sets `events` to `null` and `:247` says so.

**(judgement)** The missing SQL limit is fine at 37 rows and would not be at 400. `liveDates` takes a
`columns` string and returns the builder, so `.order('next_due').limit(n)` chains onto it without
touching the shared filter — but the browser-side window would have to move into SQL at the same time
or a limit would cut the wrong rows.

### C2. How a date opens today

`app/dashboard/page.tsx:263` — a plain link:

```tsx
<a key={e.id} href={`/calendar?tab=calendar&date=${e.id}`}>
```

Not a drawer. It navigates to the Calendar, on the Calendar tab, with the date id in the URL; the
Calendar page reads that parameter and opens the drawer itself (`app/calendar/page.tsx:526` and
`:989` write the same shape back with `router.replace`). The comment at `:261` is explicit about why:
*"A dashboard that names a deadline and cannot show it is a dead end."*

The readings list does **not** do the same thing: `:224` sends every row to `/documents` with no
parameter, so a reading on the Dashboard cannot be opened from the Dashboard. The comment at `:197`
says that is deliberate — *"one reading surface, and the drawer belongs to the page that owns the
document (`docs/DESIGN.md` §3)"*. It is a different answer to the same question than the dates panel
gives one panel above it.

### C3. What the Calendar section exposes that the Dashboard could reuse

Files only, nothing changed:

| Piece | File | What it is |
|---|---|---|
| The date drawer | `components/CalendarDateDrawer.tsx` | one date, fully opened, on the shared 720 drawer; takes `DocumentFacts` / `FindingFacts`; writes only through `PATCH /api/calendar` |
| The shared drawer frame | `components/Drawer.tsx` | the 720 frame and `printDrawer`, used by Calendar, Compliance, HR, DocumentReport, AuditReport |
| The confirm queue rows | `components/DateQueue.tsx` | the Dates-to-confirm list |
| The words for a date | `lib/calendarView.ts` | `whenWords` `:173`, `passedWords` `:183`, `repeatWords` `:161`, `NOT_CONFIRMED` `:191`, `PERIOD_NOT_READ` `:194`, `siteWords` `:242`, `metaParts` `:255`, `longDay` `:119`, `dayAndShortMonth` `:134` |
| The filter and the counts | `lib/calendarCounts.ts` | `liveDates` `:49`, `liveDatesFor` `:70`, `countsFrom` `:99`, `infoBarParts` `:139` |
| The one writer | `lib/calendarDates.ts` | `confirmDate`, `dismissDate`, `setPeriod` |

**The Dashboard already uses two of these** (`liveDates`, `NOT_CONFIRMED`) and renders its own row
markup rather than the Calendar's. It does **not** use `whenWords` — it writes `Today` / `Tomorrow` /
`in N days` itself at `:275`, which is a second phrasing of the same fact. `lib/calendarView.ts:173`
`whenWords` is the first one.

---

## D. REQUIREMENTS, CONDITIONS AND SWITCHES — CAN THE QUESTIONS BE RANKED?

**Short answer: yes, with one query against today's tables, and the ranking function already exists
and already has a route. What it does not have is a reader.**

### D1. The tables, and the exact shape of a condition

| Table | Rows (staging) | What it holds |
|---|---|---|
| `requirement_templates` | **200 live** (`effective_to is null`); 205 in all | the library. Conditions live in `applies_expression jsonb`; the prose is `trigger_condition` / `trigger_plain`; `applies` (`applies_mode` enum) says universal or conditional |
| `switches` | **95** | the vocabulary of facts. `id text` PK, `label`, `scope` (`company`/`site`), `value_type` (`boolean`/`number`/`enum`/`text`), `allowed_values text[]`, `question_plain`, `determination_source`, `depends_on_switch` / `depends_on_value`, `thresholds` |
| `company_switches` | **16 — all Test Alpha's** | one company's answers. `switch_id` → `switches` (a real FK), `entity_id` for site scope, `value text`, `state` (`switch_state`), `basis jsonb`, `user_locked` |
| `company_facts` | 1 | *"What a company has confirmed about itself that is NOT one of the 95 switches. **Nothing computes from it**"* (`docs/SCHEMA.md`) |
| `fact_proposals` | 85 | candidates read out of a conversation or a document. `switch_key text` — **and see D2** |
| `agencies` | — | `requirement_templates.agency_id` → `agencies`, on delete set null |

**The shape of a condition** — `lib/appliesExpression.ts:35–79`. Nested JSON, three node kinds and
three combinators:

```
Clause             { switch: string, op: Operator, value?: …, as?: string }   :39
InventoryClause    { inventory: 'ehs'|'tri'|'psm'|'rmp'|'cercla'|'dea_list_i' } :50   — NOT a switch
JurisdictionClause { jurisdiction: 'state'|'county'|'city', op, value }        :68   — NOT a switch
AllNode | AnyNode | NotNode                                                    :75–77
Operator = 'is'|'not'|'>='|'>'|'<='|'<'|'='|'!='|'in'|'known'                   :35
```

`switchesIn()` (`:224–230`) walks the tree and returns every `switch` key, skipping inventory and
jurisdiction nodes deliberately — both are real facts that are **not** switches, and
`lib/appliesExpression.ts:62–66` records that a draft once invented a `worksite_city` switch and
`switchesIn()` caught it.

**Two real expressions, copied exactly from staging.** The query:
`select requirement_name, applies_expression::text from public.requirement_templates
where effective_to is null and applies_expression is not null and applies_expression ? 'switch'
order by length(applies_expression::text) asc limit 2` — and the same with `? 'all'`, longest first.

*The simplest shape in the library — one clause. `Commercial vehicle annual inspection` and
`Driver qualification file` both carry it, byte for byte:*

```json
{"op": "is", "value": true, "switch": "owns_fleet"}
```

*The deepest — `Oregon sick time`, which is `CLAUDE.md` §1's own worked example ("10+ Oregon employees
or 6+ with a Portland location, in a single sentence") as the database actually holds it:*

```json
{"all": [{"op": "is", "value": true, "switch": "has_employees"},
         {"any": [{"op": ">=", "value": 10, "switch": "employee_count"},
                  {"all": [{"op": ">=", "value": 6, "switch": "site_employee_count"},
                           {"op": "is", "value": "Portland", "jurisdiction": "city"}]}]}]}
```

Three things are visible in that one row and in no summary of it: the nesting reaches **four levels**;
`employee_count` (company) and `site_employee_count` (site) appear in the same expression, which is why
§1 says the fact exists twice; and the Portland half is a **`jurisdiction` node, not a switch** —
`switchesIn()` returns two keys for this requirement, not three, and the city comes from `entities`.

### D2. How Company information asks and stores an answer

- **The page:** `app/company-information/page.tsx`. **The route:** `app/api/company-information/route.ts`.
- **Three write actions, and they go to two different tables:**
  - `action === 'declared'` → **proxied to `/api/switches/answer`**, `app/api/company-information/route.ts:190`,
    body `{ switch_id, value, entity_id }`, and the reply says `wrote: 'company_switches'` (`:204`).
    *"through `/api/switches/answer`, never around it"* (`:176`). `app/api/to-confirm/route.ts:321`
    proxies the same way.
  - `action === 'confirmed'` → `company_facts` upsert, `:250`, `basis: 'declared'`, keyed
    `company_id,key,entity_id`. It 404s if no row exists — it edits a settled fact, it cannot invent one.
  - the company profile patch → `companies`, `:170`.
- **What `/api/switches/answer` writes** (`app/api/switches/answer/route.ts`): a `switch_determinations`
  insert at `:91`, then a `company_switches` upsert at `:103`, then it recomputes obligations at `:125`
  and reports what the answer unblocked at `:131`.
- **The key used:** `company_switches.switch_id`, which has a **real foreign key** to `switches.id`
  (`docs/SCHEMA.md`, `company_switches` → *"`switch_id` → `switches` — ON DELETE NO ACTION"*). So an
  invented key cannot land there.

**The earlier finding about pending fact keys that are not switch ids — yes, it is still possible, and
it is much larger than two.** `fact_proposals.switch_key` is a bare `text` column with **no foreign key
to `switches`** (its "Points at" list is `company_id`, `entity_id`, `document_id`, `topic_id`,
`from_turn_id` — no `switch_key`). Measured on staging:

```sql
select c.name, p.status, count(*) as proposals,
  count(*) filter (where     exists (select 1 from public.switches w where w.id=p.switch_key)) as key_is_a_switch,
  count(*) filter (where not exists (select 1 from public.switches w where w.id=p.switch_key)) as key_not_a_switch
 from public.fact_proposals p join public.companies c on c.id=p.company_id
 group by c.name, p.status order by c.name, p.status;
```

| Company | Status | Proposals | key IS a switch | **key is NOT a switch** |
|---|---|---|---|---|
| Cascade | `accepted` | 1 | 1 | 0 |
| Cascade | `proposed` | 45 | 4 | **41** |
| Test Gamma | `proposed` | 15 | 0 | **15** |
| Test Gamma | `withdrawn` | 24 | 0 | 24 |

**56 of the 60 pending proposals on staging carry a key that is not a switch id.** The keys themselves
say where they come from — a model writing a plausible name rather than choosing from the vocabulary:
`employee_count_site` (the real one is `site_employee_count`), `air_permit_type` (`air_permit_required`),
`employee_count_ballard`, `employee_count_fremont`, `naics_code`, `wage_rate`, `recordable_cases_2025`.

**Where it comes from:** the scan and the overnight reader propose facts in free text, nothing
constrains the key to the vocabulary, and nothing refuses the write. **Where it stops being harmful:**
accepting such a proposal takes the `confirmed` path to `company_facts`, which nothing computes from
— so a bad key cannot corrupt an obligation. **What it costs instead:** the Company information queue
asks the person 56 questions whose answers cannot move a single requirement, and the badge counts them.
Cascade's sidebar reads **15**; Gamma's reads **5**.

### D3. How "applies" is computed, and what `/requirements` reads

- **It is code, never SQL and never AI** (§3.2, §1 layer 3). `evaluate()`, `lib/appliesExpression.ts:120`,
  returns `true | false | 'unknown'` with a three-valued truth table (`and3` `:103`, `or3` `:110`,
  `not3` `:116`). **An unset switch produces `unknown`, never `false`** — `:24–29` calls that the
  single most dangerous thing in the file to get wrong.
- **There is no view and no function** that turns conditions plus answers into applies/does-not-apply.
  The writer is `lib/obligationWriter.ts`, called from `app/api/obligations/route.ts:46` and from
  `app/api/switches/answer/route.ts:125`. It persists rows into `obligations`.
- **`/requirements` reads one thing:** `app/requirements/page.tsx:60`, `fetch('/api/obligations')`.
  That route resolves **lazily** — if `companies.obligations_computed_at` is null it computes and
  stores first (`route.ts:44–48`), then reads `obligations` joined in code to
  `obligation_evidence_state` and `agencies` (`:57`, `:64`, `:67`).
- **(hypothesis, from a count not from the code)** No company on staging has any obligations at all:
  `select count(*) from public.obligations where applicable_to is null` grouped by company returns
  **0 for all six**, Test Alpha included. Since the route computes lazily on first GET, the most
  likely reading is simply that nobody has opened `/requirements` since the 4 October restore — not
  that the writer is broken. **I did not open the page to find out**, because that is a write.

### D4. The counting query on staging

**The query, exactly as run** (Gamma's id shown; Cascade's run is identical with the other uuid):

```sql
with refs as (
  select distinct t.id as tid, trim(both '"' from s::text) as switch_key
    from public.requirement_templates t,
         lateral jsonb_path_query(t.applies_expression, 'strict $.**.switch') s
   where t.effective_to is null and t.applies_expression is not null
),
direct as (select switch_key, count(distinct tid) as n from refs group by switch_key),
answered as (
  select distinct switch_id from public.company_switches
   where company_id = '7e61edca-e1d7-4a30-96ca-784c66b49fc2'
     and state = 'known' and value is not null and btrim(value) <> ''
)
select w.id as switch_key, w.scope, w.determination_source, d.n as live_templates, w.question_plain
  from direct d join public.switches w on w.id = d.switch_key
 where w.id not in (select switch_id from answered)
   and w.determination_source <> 'computed_by_requirement'
   and w.question_plain is not null
 order by d.n desc, w.id limit 10;
```

*(`jsonb_path_query(..., 'strict $.**.switch')` is the recursive walk — the SQL equivalent of
`switchesIn()`. The `determination_source` and `question_plain` filters are `askableSwitches()`'s own,
`lib/switchAsk.ts:145–147`. "Answered" here is `state='known'` with a non-blank value; the code's
`isEstablished()` (`lib/resolve.ts`) is stricter — it also coerces the text to the switch's
`value_type` — so this query can only **over**state what is answered, never understate it.)*

**Test Gamma Solvents — top 10**

| # | Switch key | Scope | Source | Live templates | The question's own words |
|---|---|---|---|---|---|
| 1 | `has_employees` | company | profile | **32** | Do you have employees other than the owner? |
| 2 | `employee_count` | company | profile | **17** | How many people do you employ in total? |
| 3 | `ships_placardable_hazmat` | company | documents | **12** | Do you ship anything that meets a DOT hazard definition? |
| 4 | `hazardous_chemicals_present` | site | documents | **8** | Are employees exposed to hazardous chemicals in normal use or a foreseeable…? |
| 5 | `air_permit_required` | site | documents | **5** | What kind of air permit does this site hold, if any? |
| 6 | `owns_fleet` | company | **user_answer** | **5** | Do you run your own trucks, or does a carrier collect everything? |
| 7 | `tsca_regulated_substances` | company | documents | **5** | Do you handle methylene chloride, perchloroethylene, trichloroethylene…? |
| 8 | `exposure_silica` | site | documents | **4** | Could powders, fillers, maintenance, cutting, or cleanup reach 25 µg/m³…? |
| 9 | `imports_exports` | company | profile | **4** | Do you import or export chemicals? |
| 10 | `site_employee_count` | site | profile | **4** | How many people work at this site? |

**Cascade Specialty Chemicals — top 10: identical, row for row.** Not a copy-paste: **neither company
has a single `company_switches` row**, so `answered` is empty for both and the ranking is the library's
own, unmodified by anything either company has told us.

```sql
select c.name,
  (select count(*) from public.company_switches s where s.company_id=c.id) as cs_rows
 from public.companies c order by c.name;
-- Cascade 0 · Evergreen 0 · Test Alpha 16 · Test Beta 0 · Test Gamma 0 · Willamette 0
```

> **§9a: when a check reports an absence, prove it can see a presence first.** The same query run
> against **Test Alpha** (16 established switches) returns `ships_placardable_hazmat 12`, `owns_fleet 5`,
> `tsca_regulated_substances 5`, `exposure_silica 4`, `imports_exports 4` — **`has_employees`,
> `employee_count`, `hazardous_chemicals_present` and `air_permit_required` are gone from the top,
> because Alpha has answered them.** The query discriminates. The two identical lists above are a fact
> about the fixtures, not a broken query.

**The two orphan counts.**

```sql
with refs as ( … as above … )
select (select count(distinct switch_key) from refs) as distinct_keys_referenced,
       (select count(distinct switch_key) from refs r
          where not exists (select 1 from public.switches w where w.id=r.switch_key)) as keys_with_no_definition,
       (select count(*) from public.switches w
          where not exists (select 1 from refs r where r.switch_key=w.id)) as definitions_no_template_references;
```

- **Live templates whose conditions reference no known switch key: 14 of 200.** One has no
  `applies_expression` at all; **13** have an expression that names no switch — those are the
  jurisdiction-only and inventory-only expressions, which is correct and by design
  (`lib/appliesExpression.ts:50`, `:68`).
- **Switch keys that appear in templates but exist in no switch definition: ZERO.** All 83 distinct
  keys referenced across the live library resolve to a `switches` row. The library is clean.
- **The other direction: 12 of the 95 switch definitions are referenced by no live template.**
  `askableSwitches()` already drops those — *"referenced by no requirement (asking changes nothing)"*,
  `lib/switchAsk.ts:147`.

### D5. Judgement: one query, no migration — and most of it is already written

**(judgement)** **One query against today's tables. No migration, no view, no function, no cleanup of
conditions.** The three things that would have forced a migration are all already true: the
expressions are `jsonb` and Postgres can walk them (`jsonb_path_query` with `strict $.**.switch`, used
above); every referenced key resolves to a real switch, so there is nothing to clean; and
`company_switches.switch_id` carries a genuine FK, so "answered" is a reliable anti-join.

**More than that — the ranking is already built, and it is better than the query above.**
`askableSwitches()`, `lib/switchAsk.ts:135–171`, returns exactly the owner's three or four facts:
`switch_id`, `question`, `scope`, `value_type`, `allowed_values`, `blocked_by`, `affects`,
`only_a_person`. It sorts (`:165–171`) unblocked first, then the questions nothing but a person will
ever answer, then by reach, then by id so the order is deterministic (§3.2). And `affects` is
**transitive** (`transitiveAffects`, `:116–127`) — requirements naming this switch *plus* requirements
naming any switch that depends on it, because *"direct counting understates the switches that matter
most fourfold"* (`:114`). The raw counts in my table are the direct count; the code's are higher and
better ordered.

`GET /api/switches/ask` (`app/api/switches/ask/route.ts`) is that function behind a route, with
tenancy on `entity_id` and a 404 rather than a 403 for another company's site (`:44–46`).

> ### AND IT HAS NO CALLER. §9a: a thing is done when something real uses it.
> `grep -rn "api/switches/ask" app components lib scripts tests` returns **three lines, all of them
> prose**: the route's own docstring (`:2`), its error log (`:93`), and a comment on the Requirements
> page (`app/requirements/page.tsx:197`) that says *"The ask lives behind this"* — above a `<button>`
> at `:206` with **no `onClick`** (it renders `v.action`, chosen in `renderUnknown`). The route's docstring opens by noting that `lib/switchAsk.ts` had
> *"six exports and six tests since 13 September and no production caller"* and calls itself the
> caller. It is the same condition one layer up: the route now has none either.
>
> **So the owner's third block is not a build. It is a fetch.** The hardest part — deciding what to
> ask, in what order, and what each answer is worth — is written, tested and deployed.

---

## E. THE SHARED FRAME

### E1. What HR and the Calendar use, and whether the Dashboard does

| Piece | File | HR | Calendar | **Dashboard** |
|---|---|---|---|---|
| App shell | `components/AppLayout.tsx` | yes | yes | **YES — the only one** |
| Sidebar badge | `components/AppLayout.tsx:235–240` | n/a (the shell draws it) | n/a | n/a |
| Tabs | `components/Tabs.tsx` | yes | yes | **no** |
| Sheet | `components/Sheet.tsx` | yes | via `AddDateSheet`/`RemoveDateSheet`/`SendCalendarSheet` | **no** |
| Empty | `components/Empty.tsx` | yes | yes | **no** — it writes its own empty states inline at `:216` and `:253` |
| Drawer | `components/Drawer.tsx` | yes | yes | **no** |
| FoldRow | `components/FoldRow.tsx` | no (only `ReportView`) | no | **no** |
| buttonStyles | `components/buttonStyles.ts` | yes | via `AddDateSheet`, `CalendarAsk` | **no** |
| The info bar | `lib/calendarCounts.ts:139` `infoBarParts` | n/a | yes | **no** |
| Print frame | `lib/printFrame.ts` | yes | yes | **no** |
| The ask box | `components/CalendarAsk.tsx` | HR has its own | yes | **no** |

**The Dashboard uses one shared piece: the shell.** Everything else on the page is its own markup.
That is not automatically wrong — it is the only page in the product that is a summary rather than a
workspace — but it is why it sits on a 1024 column while the others sit on 900, and why it phrases
"in N days" itself instead of calling `whenWords` (`lib/calendarView.ts:173`).

### E2. What the owner's three blocks would need that does not exist

A short list, nothing built:

1. **A number tile.** There is no shared one. The Dashboard's four are inline markup at
   `app/dashboard/page.tsx:190–193`; `grep -rn "StatTile\|NumberTile\|Metric" components app` returns
   nothing. Five tiles instead of four also breaks the current `lg:grid-cols-4`.
2. **A tile that is a link.** None of the four is clickable today. "Issues identified → 40" wants to
   go somewhere, and gaps and findings live on two different pages.
3. **A question card that can take an answer in place.** The Company information page has the
   pattern (`action: 'declared'` → `/api/switches/answer`) but not as a reusable component; the
   Dashboard would need a card that renders an `Askable` (`lib/switchAsk.ts:38–50`) and posts an answer.
4. **A client-side reader for `/api/switches/ask`.** The route exists; nothing fetches it (§D5).
5. **A counter read.** Nothing in the UI reads `usage_counters`; §F.
6. **A shared "three questions" list component**, if the Requirements page is ever to show the same
   three facts — otherwise that is a second phrasing of one ranking, which is the failure
   `lib/calendarCounts.ts:11–16` was written to stop.

---

## F. WHAT ELSE TOUCHES THE DASHBOARD

**Every link to `/dashboard`** — `grep -rn "/dashboard" app components lib scripts tests prototypes`:

| File:line | What |
|---|---|
| `components/AppLayout.tsx:40` | the first sidebar item, on every signed-in page |
| `components/AppLayout.tsx:268` | the CompliBoard logo in the header |
| `app/reset-password/page.tsx:46` | `setTimeout(() => router.push('/dashboard'), 2000)` |

*(Three more matches are prose or test paths: `app/api/calendar/route.ts:121`, `lib/documentStatus.ts:43`,
`tests/unit/calendarShell.test.ts:454` and `:483`. Two more are `supabase.com/dashboard` URLs in
`scripts/db-types.js:22` and `:47` — a different dashboard.)*

**Every file that imports from the Dashboard's files: none.** `grep -rn "from '@/app/dashboard"`
returns nothing. `app/dashboard/page.tsx` is a Next.js page with a default export and no named
exports; the only files that open it do so with `readFileSync` in a test.

**Every job or route that writes something only the Dashboard reads: nothing found.** The search was
each of its five reads in turn. `profiles`, `companies`, `calendar_v`, `document_index_v` and
`checklists` all have other readers — `components/AppLayout.tsx:139`/`:146` reads the first two,
`app/calendar/page.tsx` and `lib/calendarCounts.ts` read the view, the Documents page reads `document_index_v` through
`app/api/documents/index/route.ts:27`, `app/compliance/page.tsx` reads `checklists`.

> **The reverse is the finding.** `usage_counters` has **five writers and no reader in the product.**
> `grep -rn "usage_counters"` returns the five `bumpCounter` sites, `lib/conversation.ts`,
> `app/api/account/route.ts:199` and `:401` (the deletion lists), `lib/database.types.ts`, and
> `scripts/check-live.js:946`. **No page and no route reads it.** It has been counting correctly since
> migration 032 and nothing has ever shown a customer the number.

---

## G. BLOCKERS

Nothing makes the owner's three blocks impossible. Seven things make them risky or need a decision
first, one line each.

| # | The thing | Where | Why it matters |
|---|---|---|---|
| 1 | **Nothing lands a person on the Dashboard.** Sign-in and sign-up both push `/`, the marketing page, which shows "Sign in" to a signed-in person | `app/login/page.tsx:29`, `app/signup/page.tsx:193` and `:203`, `app/page.tsx:18` | Building three blocks on a page most people never see first is work nobody sees. **A product decision, not a bug fix** — it may be the right landing, but it should be chosen |
| 2 | **"Questions answered" reads 0 on a company that has answered 31**, because the tile counts `checklists.research_answer` instead of the counter | `app/dashboard/page.tsx:137` vs `usage_counters.questions_answered` | §6 — the Dashboard asserting a confident wrong number is the named anti-pattern, and this is the same class as the 28 September `document_reviews` zero recorded at `:107–113` |
| 3 | **Cascade has no `usage_counters` row at all** | `lib/conversation.ts:188`; staging query in §B4 | A counter-based tile must `coalesce` a missing row to 0. A join that drops the row would draw a blank tile on a brand-new company — every new customer, on their first visit |
| 4 | **A checklist made from a document gap bumps no counter, and the file says it does** | `app/api/document-checklist/route.ts:8` claims the counter; the file has no `bumpCounter` | Moving the tile onto the counter would make "Checklists created" undercount for exactly the Documents-heavy customer the product is sold to |
| 5 | **"Issues identified" ignores audit findings** — Gamma has 34 open and the tile says 6 | `app/dashboard/page.tsx:136`, `audit_findings.status` | Whether findings join gaps in one number is a **product decision**. Either answer is defensible; the current one is not, because it is the sum of one of two sources without saying so |
| 6 | **56 of 60 pending `fact_proposals` on staging carry a key that is not a switch id**, and the column has no FK | `fact_proposals.switch_key`; staging query in §D2 | A Dashboard that asks "the facts that would settle the most requirements" must rank from `switches`, **never** from `fact_proposals` — the queue is full of keys no requirement can use, and the sidebar badge already counts them (Cascade: 15) |
| 7 | **No company on staging has any obligations, and none has any `company_switches` row but Test Alpha** | `obligations` and `company_switches` counts, §D3 and §D4 | The ranking block cannot be *demonstrated* on staging — both companies return the identical library-wide list. Answering one switch as `testgamma` would fix it, and that is a write this job may not make |

**Not blockers, recorded in passing:** `requirement_templates` and `switches` grant `authenticated`
INSERT/UPDATE/DELETE while carrying only a SELECT policy (`docs/SCHEMA.md`), so RLS denies the writes
and the grant is merely redundant — but it is the §3.6 shape that has bitten twice, and a future
policy added to either table would open a write nobody granted deliberately.

---

## H. EFFECTS ON OTHER SECTIONS, BY FILE (§9.1)

**This job changed no code.** It added `docs/DASHBOARD-MACHINERY.md` and two screenshots in
`shots/` (git-ignored). What follows is what a future Dashboard change would touch outside the
Dashboard, by file — the point of §9.1's last clause.

| If a later step... | ...it changes these files, outside the Dashboard |
|---|---|
| moves the tiles onto `usage_counters` | nothing in Documents or HR, **but** `app/api/document-checklist/route.ts` needs the missing `bumpCounter` (blocker 4), and `scripts/check-live.js:946–997` is the only existing probe of those counters |
| adds audit findings to "Issues identified" | `app/audits/page.tsx` and `app/api/audits/index/route.ts` own the same number today; two phrasings of one count is the `lib/calendarCounts.ts:11–16` failure |
| reuses the Calendar's date words | `lib/calendarView.ts` (`whenWords` `:173`) gains a second caller — a change there would then move the Calendar, the queue, the drawer **and** the Dashboard at once |
| puts the Dashboard on the 900 column | `components/AppLayout.tsx:353`'s footer box already assumes 900, so the footer stops being 62px out of line; nothing else moves |
| fetches `/api/switches/ask` | `app/api/switches/ask/route.ts` gets its first caller, and `lib/switchAsk.ts` its first production reader; answering goes through `app/api/switches/answer/route.ts`, which **recomputes obligations** (`:125`) — so a Dashboard answer changes what `/requirements` shows |
| drops the local `KIND_WORD` for the shared one | `lib/documentStatus.ts:43`'s comment names the copies and is already stale about the line number; `components/DocumentReport.tsx` and `components/AuditReport.tsx` still carry their own |
| changes any of the five reads' columns | `scripts/check-schema-contracts.js` validates them offline and will refuse a wrong name — it is the gate, and it passes today (311 files, 58 relations) |

---

## I. WHAT THIS DOCUMENT DOES NOT ANSWER

- **Production.** Not read, for the reason in the header. Every number here is staging.
- **Whether `/requirements` currently renders anything.** `obligations` is empty for all six staging
  companies; the route computes lazily on first GET, which is a write, so it was not triggered.
- **Whether `transitiveAffects` and the direct count differ much in practice.** The code's number is
  higher by construction (`lib/switchAsk.ts:114`); the amount was not measured, because measuring it
  means calling `/api/switches/ask`, and that route is a GET on a page that does not exist yet.
- **What the three or four questions should be.** §D4 gives the ranking; which of them the owner wants
  on a dashboard, at what scope, and whether a site-scoped question belongs on a company-wide page at
  all, are product decisions.
