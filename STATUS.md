# STATUS

**Version:** 29 · **Updated:** 8 October 2026 — the HR row: the new HR live on production. Version 28: 8 October 2026 — the HR row: the new HR built and released (§181). Version 27: 4 October 2026, HR Step 2 — the HR row: being rebuilt (`docs/HR-PLAN.md`).
**Supersedes:** version 26 (4 Oct, at the close of the workspace work). Version 26 superseded version 25 (28 Sep).

> ### THE COMPLIANCE WORKSPACE IS LIVE THROUGH STAGE 4, AND BOTH DATABASES ARE ON `000`–`065`.
>
> **Production and staging are on `000`–`065` — 66 migrations each** (`npm run preflight`, 4 October: 66 on
> disk, 66 applied, `PENDING COUNT: 0`). `origin/main` is at `fd2ddfa`. The block below, from 28 September,
> says `000`–`054`; it is kept as it was.
>
> **Live on production, 4 October** (`DECISIONS.md` §153–§163): the workspace in the Audits shell; files
> staged and read on send; the summary report as an accordion; the checklist in three groups; "How do I do
> this?"; one-line source links; the shared print frame; summaries, checklists and "How do I do this?" that
> claim their work and finish after the reply (migration 065), proven on production by closing the tab
> mid-summary (the owner's map); and **the four nightly jobs**, answering Vercel Cron's GET — the sweeps show
> GET 200 in Vercel (the owner's map). **Still to see:** the first `summarise` and `delete` rows in production's
> `job_runs` on the morning of 5 October (`docs/TESTING.md`, CR-2).
>
> **Production runs `claude-opus-5-5` for every model setting, effort `medium`**, all saved visible
> (`docs/RELEASE.md`, the authoritative list). **Re-checked today:** the migration line and git. **Rows changed
> today:** the workspace page, usage counters (the 7-day rule is gone), nightly jobs. Every other row keeps its
> date.

> ### DOCUMENTS REV 1 IS LIVE ON PRODUCTION, AND THE MIGRATION LINE MOVED 15 FILES.
>
> *(Corrected 28 September 2026. Version 24 said "both databases are on **000–039** — 40 migrations
> each … `npm run preflight` reporting **PENDING COUNT: 0**". That was true on 23 September and wrong
> from the 26th.)*
>
> **Production and staging are on `000`–`054` — 55 migrations each.** Migrations 040–054 went to
> production on **26 September** with Documents rev 1; `docs/releases/2026-09-26-documents-rev1.md` is
> the release note and its §7 smoke test carries the outcome of every step.
>
> **Production reads documents on `claude-opus-5-5` with `AI_SCAN_STRUCTURED = false`.**
> `docs/RELEASE.md`'s closing list is the authoritative record of what Vercel holds — not this file and
> not `CLAUDE.md`, which disagreed with it for three days (`DECISIONS.md` §136).
>
> **New rows below:** the Documents page and its report drawer, the scan, the sweep, the batch email
> and the To confirm queue. **Re-checked today:** the migration line, the production model, the routes
> and who calls them (`docs/INVENTORY-2026-09.md` is the file-by-file pass). **Not re-run today:**
> everything version 24 already listed as not re-run, and its dates are left standing rather than
> restamped.

**THE RESEARCH SECTION IS LIVE ON PRODUCTION.** Fix Round 1 (§127, §128) and Fix Round 2
(§129) shipped with it. New rows below for the **cost ledger**, the **attachment path** and the
**three research switches**. RLS re-counted today: **81 policies across 30 tables, 74 through
`auth_company_id()`** — this file carried 75/27/68 since 13 Sep.

> ### WHAT WAS RE-CHECKED TODAY, AND WHAT WAS NOT.
>
> Re-checked today against the database or by running it: the migration chain, RLS, the library,
> agencies, switches, coverage, every conversation-era row, the research and checklist answers,
> the attachment path, and the cost ledger. **Not re-run today, and their dates are left
> standing rather than restamped:** Audits, HR, Calendar, Dashboard, Signup, Upload, the
> Requirements screen, the critic pass, the determination gate and the obligation writer. A date
> in this column means somebody checked on that date; moving it without checking is the one
> thing that would make this file worthless.

Version 22: **RUN 2** (`DECISIONS.md` §125): conversations persist, the
nightly jobs run, and **three of §116's four retention gates are built** — the privacy policy is
the fourth and is the owner's. Retention is **7 days from summarising**. Four new rows below.
Staging is on **000–036** and was **rebuilt from zero again on 23 Sep** — 37 migrations, all eight
restore steps, every count matching its source — and that run **refused migration 031's own verify
block**, a zero-row probe that raises nothing, which is §98 catching this run's work. Answer caps
raised to 16000 after Run 1 measured truncation; `AI_EFFORT` set back to the API default `high`.
**Production is still on 000–030** and this run touched nothing there. Version 21: **THE OPEN BASELINE SHIPS** (`DECISIONS.md` §123, `TODO.md`
R1.0 + R1.1): research and checklist run one open streaming call — a single sentence of role,
search the model decides on, history as plain pairs — with all six pipeline pieces behind config
switches that default off. Three new rows below: **research answer**, **checklist answer** and
**micro-steps**, each re-checked today by driving `/api/chat` as `testgamma` on staging.
Measured: **33.1 s / 6.2 s / 11.3 s**, first text at 1.3–2.8 s, inside the 800 s limit the route
now declares. **Answer quality is deliberately unscored** — that is the owner's judgement against
an incognito chat (§115). Version 20: **BOTH ENVIRONMENTS ARE ON 000–030.** Production was caught up
on 22 Sep — the owner ran `npm run preflight` (pending was exactly 029 and 030), then
`db:migrate:prod`; both applied, and their objects were checked on production rather than assumed
(2 critic tables, `checklists.research_sources` present and nullable). **Staging was rebuilt FROM
ZERO the same day** — 31 migrations against an empty database, then seven data steps, every count
matching its source file — which **CLOSES `DECISIONS.md` §98's owed reset**. Re-read from both
catalogs today: library identical either side at **205 requirement rows (5 retired, 17 children,
199 expressions) · 33 agencies · 56 coverage rows · 95 switches · 40 edges**; production carries
*(Corrected 28 Sep: these counts were read on 23 September and are not restamped — production has
since gained the rev 1 tables and at least one document. They are left as a dated reading, which is
what this file is for.)*

**10 companies · 4 profiles · 10 entities · 38 documents · 11 checklists · 235 checklist_items ·
0 obligations · 0 company_switches**; staging carries the three test companies, 4 profiles, 4 sites
and 16 multi-site facts and nothing else. Three defects were found **only** by running from zero
(§118, §119, §120), and a fourth beside them: **`npm run preflight` could not parse from 15 to 22
Sep (§121), because `npm run check` executes 2 of this repo's 22 scripts.** Release timing is
**ANSWERED** (§117): every module ships in the first release. Version 19: version 18 (15 Sep). **Staging is on 000–030 and was REBUILT FROM ZERO** — the chain
plus the seed files reproduce the whole database, proved by running it rather than asserted
(`DECISIONS.md` §98, now CLOSED). Counts re-read from the catalog on 22 Sep: **requirement_templates
205 · agencies 33 · industry_coverage 56 · switches 95 · edges 40 · applies_expression 199 ·
companies 3 · entities 4 · company_switches 16.** **Production was still on 000–028 AT THAT
VERSION** — pending was exactly 029_critic_findings.sql and 030_research_sources.sql, both additive.
Both were applied later the same day; see version 20 above. The
library worksheet is now `REQUIREMENTS.xlsx` at **205 rows** and is authoritative (§118). Three
defects were found only by the from-zero run — §118, §119, §120 — and a fourth beside it: **`npm run
preflight` could not parse from 15 to 22 Sep (§121), and `npm run check` executes 2 of this repo's
22 scripts.** Version 18: version 17 (15 Sep). Sweep; every number re-read. **Both environments on 000–028,
applied 29.** M1.2b, M1.2 and M1.2c landed — **the conversation loop is closed and reachable over
HTTP for the first time**, with signed turns, contiguity, and four attacks refused (§89–§91).
**288 tests.** `lib/` is down from four unreached modules to **one** (`sdsExtraction`);
`folderTemplates` was deleted as the residue of a removed feature. The **eighth credential**
(`TURN_SIGNING_SECRET`) is on the rotation gate, born-rotated. And the qualifier is unchanged:
**0 of 200 live requirements checked against a published source**, 22 of 216 clauses that can
never fire. Version 17: Sweep; every number re-read on 15 Sep. **Both environments on
000–028, 0 object differences, census 879 objects and sha256 identical.** Four things landed:
**7.2a driven over real HTTP** as a signed-in user (49 ready · 31 blocked, eight guards probed,
two of them re-run after passing for the wrong reason); **M1.1's `topics` shipped to production**
with no facts column (§78); **`CLAUDE.md` §3.6 corrected** — the default ACL grants
`authenticated=arwdDxtm` including DELETE, so a grant list describes what you added, not what the
role holds; and **M1.2b specified** (`docs/archive/GATE-HISTORY.md`). **274 tests.** Two measurements now
exist where none did: **21 applies of 200 CREATED** and **5 MOVED** of 200. And the qualifier is
unchanged: **0 of 200 live requirements checked against a published source**, 22 of 216 clauses
that can never fire. Version 16: End-of-session sweep; every number re-read from the databases
or the repo. **7.2a's ROUTES DO NOT EXIST** — `/api/switches/*` is absent and four modules
(`switchAsk`, `switchDetermination`, `sdsExtraction`, `basis`) have no production caller at all,
derived by grep rather than recalled. What did land: **7.3, M6 and 4.3**, and the chain runs end
to end — a person ran it in a browser, 221 obligations persisted for one fixture and **zero** for
the other, both rendering the correct sentence. **274 tests.** Staging is on 024 and production on
023, so **the environments differ by one migration.** **Production holds 0 obligations and 235
AI-generated `checklist_items`** — the deterministic spine has no rows in front of anyone
(`DECISIONS.md` §68). And the qualifier that outranks all of it: **0 of 200 live requirements have
been checked against a published source**, and **22 of 216 switch clauses can never be true**.
Version 15: Sweep after 7.2a, 7.3, M6 and 4.3, and after the manual set's
first run — every number below re-read from the databases or the repo on 13 Sep. **Both
environments on 000–023, 0 object differences.** The chain runs end to end and a person has now
run it: a question answered, resolution recomputed, **221 obligations persisted** for one fixture
and **zero** for the other, both rendering the correct sentence. **Production holds 0 obligations**
— the write is lazy and fires on a GET, and no production company has been viewed. **250 tests.**
And the qualifier that outranks all of it: **0 of 200 live requirements have been checked against
a published source** (`verified_at` and `source_checked_at` NULL on all 205 rows), and **22 of 216
switch clauses can never be true**, so `applies_expression` is ⛔ broken and `does_not_apply` must
not be shown to a customer until `TODO.md` 6.4c is done. Version 14: **The mechanism is proved end to end by a person and the content is not.** Cases E, F, G and I pass: the first GET writes, the reload is idempotent, the pre-existing obligation was closed rather than deleted, both empty states render. **Then a ten-minute domain read of the rendered rows found what 199 expression reviews had not** — 22 of 216 switch clauses can never be true, so **a large-quantity generator receives zero hazardous-waste obligations and is told so confidently.** `applies_expression` moves to ⛔ broken; `DECISIONS.md` §64, check 28, `TODO.md` 6.4c, which gates showing `does_not_apply` to any customer. **023 is on staging only** — production stays on 022 until Case E had passed, which it now has. Version 13: **The obligation writer had never run through its own route** — proved by a service-role script, which made every later request skip the write. As the caller it holds EXECUTE on neither function it calls and returned **500 for every uncomputed company**, which on production is all ten. Found by the manual set on its first run (`DECISIONS.md` §63). **Migration 023 is on staging and NOT on production**, so the two environments now differ by one migration and production would still 500. Version 12: **The chain runs end to end for the first time.** A question is
answered, resolution recomputes, **221 obligations persist**, and `/requirements` renders them —
every `does_not_apply` naming the switch and its value, **39 of 39**. Migration **022 is on
production** and the two environments compare **object-for-object with 0 differences across 10
categories**. Production holds **0 obligations and 0 `company_switches`**, correctly: the write is
lazy and no customer has opened the screen. **245 tests.** And the qualifier that belongs beside all
of it: **0 of 205 requirement templates have been checked against a published source** —
`verified_at` and `source_checked_at` are NULL on every row — so the machinery is sound and the
content at the end of it is unverified. Version 11: Documentation sweep — every count below re-read from the
database or the repo on 12 Sep. **167 tests**, and the runner now refuses to shrink. Records
what 7.2 built and, as plainly, **what it did not: no route calls any of it.** Version 10:
**Phase 7.2's schema is on production** — both environments
on 000–017, **840 census objects, 0 differences, byte-identical**. `switch_determinations`
exists in both and holds 0 rows; `obligations`, `company_switches` and `company_chemicals` are
all 0 on production, because **nothing has run determination for a production company and
nothing should yet.** Version 9: **Phase 4.1 is on production** — both environments on
000–016, **799 census objects, 0 differences, byte-identical**. The resolution engine exists
in code with 119 tests behind it and `close_and_replace_obligations` exists in both databases.
**`obligations` is 0 rows in production and stays that way**: nothing calls the engine there
yet. Version 8 was the documentation sweep: every count below re-read from the
database on 12 Sep, not carried forward. **Phase 6.3 is on production** — both environments on
migrations 000–014, 205 requirement rows with 199 machine-evaluable conditions, 95 switches,
**798 census objects and 0 differences**. Version 7 first recorded 6.3. Version 6 recorded that **Phase 2 is closed.** Records the measured per-stage
latency and which stage owns it, and the gate-result bug now fixed. Version 5 added the critic
pass and model tier routing, and records
the audit consistency spread now that it is measured. Version 4 recorded phases 2.1, 2.2 and 6.2: the agency list and
requirement assignment, the determination gate, and the switch library. Version 3 recorded
the document-parsing unification. Version 2 corrected version 1, which said production was
on 009 when it was on 007.
**Environment:** **staging and production both on 000–017**

> ✅ **The two environments are the same shape.** Compared object for object — tables,
> columns with type, nullability and default, constraints with definitions, indexes,
> policies with roles and their USING and WITH CHECK, triggers, functions by body hash, enum
> values, table ACLs and RLS flags — **840 objects each, zero differences, in either
> direction, the two outputs byte-identical (sha256 `6ecf7467ec5ee534…`), re-verified 12 Sep
> after migration 017.** Verified 12 Sep after 013 and
> 016. `anon` holds nothing on either side, and `PUBLIC` holds no EXECUTE on
> `close_and_replace_obligations`. **799 after 015 and 016**, up one from 798 for a single
> attributable reason — `g_function` 5 → 6, the new stored function.
>
> **798 is not growth over the 619 this file reported, and 619 was not a drop from 673.**
> Three runs, three censuses, none of them comparable: the 673 counted grants through
> `information_schema.role_table_grants`, which filters to roles the caller belongs to and
> returns nothing here; the 619 dropped them; this one reads ACLs from `pg_class.relacl` and
> adds column defaults, policy roles and enum ordering. **The census is now a file —
> `supabase/census.sql` — precisely so a fourth number cannot be a fourth question.**
> `AUDIT-CHECKS.md` check 10 has the detail, including two traps it documents: a SQL file
> beginning with `--` is parsed as command-line flags, so the tool prints its help and the
> pipeline compares two EMPTY outputs and calls them identical; and UUID primary keys are
> generated per database, so joining `requirement_templates` on `id` across environments
> reports 34 differences that are not differences. Key on `requirement_name`.
>
> This file previously said production was on 009 when it was on 007. That was written from
> recollection rather than from the database and was caught by a pre-flight. **Every count
> in this file is read from the database, and was re-read on 12 September.** That rule now
> also covers *checking* and not only *writing* — three false alarms in one session came from
> comparing against remembered numbers (`HOW-WE-BUILD.md` §3, `DECISIONS.md` §46).

## Why this file exists

During a rebuild, *"broken because we have not rebuilt it yet"* and *"broken and nobody
noticed"* look identical from outside. Both are a screen that does not work. Only one of
them is a problem.

This file is the difference. One line per module, what state it is in, and **when that was
last actually checked** rather than last assumed.

**`unknown` is a real answer and is used here.** A module marked unknown has not been
exercised recently enough for anyone to say. That is more useful than a confident guess,
which is the exact failure this file exists to prevent.

| State | Means |
|---|---|
| ✅ **working** | Exercised on the date shown and did what it should |
| 🟡 **degraded** | Works, with a known defect that changes what it tells the user |
| ⛔ **broken** | Does not work |
| 🔧 **not-yet-rebuilt** | Deliberately not working — waiting on a phase, not a bug |
| ❓ **unknown** | Not checked recently enough to say |
| ⬜ **not built** | Does not exist yet |

---

## Modules

| Module | State | Verified | Notes |
|---|---|---|---|
| **Requirements screen** (`/requirements`) | ✅ working | 13 Sep | **Rendering real persisted rows for the first time, staging only.** Test Alpha Chemical: **221 obligations — 45 `applies`, 39 `does_not_apply`, 136 `unknown`, 1 `undetermined`** — in three peer sections with **no counts in the headings**, `undetermined` at the foot of the questions section under its own heading. Every `does_not_apply` names the switch and its value: **39 of 39** match `^Ruled out by: [a-z_]+ = `. The screen found two defects nothing below it could see, both with `resolve()` correct and the loss in the read: 12 rows rendering no fact at all, then those same 12 offering a question with nothing behind it (`DECISIONS.md` §61, audit check 26). **Not exercised by a person yet** — `docs/TESTING.md` cases E–I. |
| **Audits** (`/audits`) | ✅ rebuilt | **30 Sep** | **THE OLD ENGINE IS RETIRED AND ITS ROUTE DELETED — 30 September 2026, Run 3.** It was `🟡 degraded` on one measured defect that could not be fixed by fixing it: six audits of the same 272-item ISO 9001 standard for the same company returned `satisfied` of 6, 9, 7, 15, 13 and 21 — **a 3.5× spread**, with 219 of 272 items citing no document at all in the worst run (`archive/AUDIT-CHECKS.md` check 16) — and it silently dropped documents it could not read (`if (dlError || !fileData) continue`, no error, no record). The cause was structural: it asked a model to enumerate a standard from nothing, which is the known-bad mode (§3.3). **What replaces it anchors every answer in a document.** The page is two tabs over `audit_runs` / `audit_sections` / `audit_findings` (migration 058): one folded line per agency the company's own readings name, a box that matches a typed sentence against those labels **in code, with no model call**, a 720 drawer whose every line points at a document or says what is not on file, a print whose last page lists the documents cited, and a zip of the originals in citation order. The audit itself is one open call per agency, measured over three runs per case against written keys in `tests/golden/audits/` (§144, §145). **The tables `audits` and `hr_audits` are kept**: they hold what customers were shown, and an audit somebody acted on is not ours to delete. | **Not yet exercised by a person** — `docs/TESTING.md` carries two manual sets for it. The template audit (auditing against a checklist a customer attaches) returns 400 with a sentence saying it is not ready; the box's third example line names it and the attach control is inert and says so. No page for the findings beyond the drawer. |
| **HR** (`/hr`) | 🟢 live | 8 Oct, production: the free live checks after the deploy (`/hr` serves the new page; old routes 404; no login 401). Staging: the go-live proved (`DECISIONS.md` §181) and the Opus machinery run (HR C). The owner's paid check on production is still to come | **The new HR (`docs/HR-PLAN.md`) replaces old HR at `/hr` from 8 October 2026** (`804d85e`): handbooks read and checked against the law, answers with checked quotes and links, summaries, the night queue. Old HR is retired. Held for the finish line: the yardstick, the manual sets and the switches (`docs/TEST-AT-FINISH-LINE.md`, HR). |
| **Documents** (`/documents`) | ✅ working | **28 Sep** | **REBUILT AND RELEASED — Documents rev 1, on production since 26 September.** One table filtered by folder or site and grouped by anything; a report drawer reading ten sections off six tables; one reading per file however it arrives (`/api/document-scan`); uploads of four or more handed to the background sweep with one email and one banner; a To confirm queue where nothing about a company is written until somebody says so. **The Review button and the separate date-extraction call are gone from this page.** Read on `claude-opus-5-5`, schema off. Migrations 040–054. `DECISIONS.md` §131–§139, `docs/VISION-DOCUMENTS.md`, `tests/golden/documents/bakeoff/2026-09-27-rejudged.md`. *(Corrected 28 Sep: the debts this row listed are closed — review no longer runs inline or twice, and `document_gaps.superseded` records what a re-reading replaces. The M4 pointer is superseded; see `TODO.md`.)* Remaining debt: `ScanStatus` makes one field answer both "what kind of conclusion is this" and "were gaps found", so a record with findings has to read `gaps_found` — the bake-off's first spec correction, and a column/migration/display decision, not a bug. |
| **Documents — the sweep** (`/api/jobs/scan-documents`) | ✅ working | **28 Sep** | Vercel Cron every five minutes, plus `after()` from `/api/document-batches` and `/api/document-rescan` so a queue starts draining in seconds rather than at the next tick. One company at a time and its documents one after another, claimed company-wide on `reading_since`. Verified 28 Sep by abandoning the caller the moment it answered: POST returned in 1.4s, the reading landed 84s later, old scan kept at `is_current = false`. `DECISIONS.md` §138. |
| **Documents — To confirm** (`/to-confirm`) | ✅ working | 26 Sep | Fact proposals from both sources, grouped by key, one question per fact, with disagreement shown and settled by the person. Sidebar count. Nothing is written to `company_switches` or `company_facts` until confirmed. |
| **Calendar** (`/calendar`) | ✅ working | 11 Sep | Converted and verified the same way. **11 Sep: an unreadable import now says why, instead of "No compliance dates found in this file. Make sure it contains deadline or expiry dates." — shown for documents that had been rejected before any date-finding ran** (`CLAUDE.md` §5.1, `DECISIONS.md` §27). **Its picker is still narrower than its route** — no images, though `/api/extract-dates` reads them. Debt: dates are extracted from documents rather than read from obligation cadence (`TODO.md` M5). |
| **Dashboard** (`/dashboard`) | ❓ unknown | — | **Not exercised this session.** Reads calendar, document reviews and checklists — **not** obligations — so the empty obligations table does not affect it. That is from reading the page, not from running it. |
| **Compliance workspace** (`/compliance`) | 🟡 degraded | 15 Sep | **M1's conversation loop is live on `/api/chat`** — the route verifies signed turns, passes them to the gate, and returns a new signed turn. **The gate also classifies each turn** (`first` / `elaboration` / `refinement` / `new_question`, with `refersToTurn` and a stated `because`) — folded into the same call rather than a third AI call (§85, §86). Run over HTTP as a signed-in user: **turn 1 with no turns sent returns a signed turn; turn 2 sends it back and the gate does not re-ask what turn 1 established.** Four attacks refused with 400 — edited value, invented turn, **a genuine turn with the one before it dropped** (§90), and replay into another topic. **Degraded on latency, and it is a PRODUCT problem rather than a defect (§92): 58.9 s first turn, 29.0 s second**, gate plus answer with no critic. **The 1,282-line page does not yet hold turns between requests**, so the loop is reachable by a request and not yet by a person. |
| **Signup** (`/signup`) | 🟡 degraded | 11 Sep | **Was ⛔ broken in production for roughly two hours today** — migration 007 renamed `industry` → `industries[]` and `/api/industries`, the only caller, kept selecting the old name, so the dropdown came back empty and blocked signup. **Fixed and verified 11 Sep.** Still degraded: does not capture `county`, and `employee_count` is never asked for (writes NULL). |
| **Upload** (`/upload`) | 🟡 degraded — **and unreachable** | 12 Sep | *(Corrected 28 Sep: **nothing links to this page.** `grep -rn "/upload"` over `app` and `components` returns no nav item, no link and no redirect — it is reachable only by typing the URL, and `/documents` is the upload surface now. `docs/INVENTORY-2026-09.md` proposes archiving it; the defect below is real and is on a page no one can get to.)* |
| **Upload — the original notes** | 🟡 degraded | 12 Sep | **12 Sep: now sends the session token, since `/api/chat` requires one.** `app/upload/page.tsx:89` calls `getPublicUrl` on a private bucket — **still broken**, predates this work, `TODO.md` §0.7. 11 Sep: picker widened to the shared list, and a refused file now reaches the error banner this page already had instead of a bare `catch {}` commented *"extraction failed silently"*. |

## Infrastructure

| Piece | State | Verified | Notes |
|---|---|---|---|
| **Tenancy / RLS** | ✅ working | **23 Sep** | **81 policies across 30 tables, 74 of them through `auth_company_id()`** — re-read from `pg_policies` today, correcting the 75/27/68 this row carried since 13 Sep. The six added since are 034's two, 038's one on `ai_calls` and the storage policies 037's bucket finally has something to apply to. `anon` holds zero table grants anywhere. Verified by comparing row counts under a caller's token against the service role, not by HTTP status. |
| **Storage scoping** | ✅ working | 10 Sep | Six tests with real sessions: a company can read and write only its own prefix. Before migration 002 every authenticated user could read and delete all 52 files across 7 companies. |
| **Migration chain** | ✅ working | **23 Sep** | **000→039 on BOTH environments** — `supabase_migrations.schema_migrations` reports **40 applied, latest 039** on each, read today; `npm run preflight` derives **PENDING COUNT: 0** in front of the reader. The gap that stood from 031 to 039 is closed: the owner ran `db:migrate:prod` after Fix Round 2. **The chain still builds from nothing** — `npm run db:restore` proved it on 23 Sep (§98, CLOSED), and 037 added the storage bucket the chain had never created (§127). `npm run db:migrate` runs `check:live` after every staging migration; `db:migrate:prod` does NOT, by construction (`AUDIT-CHECKS.md` check 27). |
| **Requirement library** | 🟡 degraded | 12 Sep | **205 rows in both environments — 200 live, 5 retired parents, 17 split children, 0 orphaned lineage.** **The library grew from 194 rows to 205 and NOT ONE is new regulatory content.** Migration 013 split three under-decomposed rows — Electronic OSHA injury-data submission into 3, Process Safety Management into 5, Permit-required confined spaces into 3 — so 11 children replaced 3 parents: total 194 → 205, live 192 → 200. Every child's text is derived from its parent's (`CLAUDE.md` §5, and the split test is `DECISIONS.md` §44.4). **193 of 200 live rows carry a regulator**, 7 deliberately NULL. Jurisdiction: 99 Oregon at state layer, 3 Oregon local, 95 federal, 3 with no layer. **Degraded on one axis and it is the important one: all 200 live rows carry a citation, and 0 carry a `citation_url`, a `citation_quote` or a `source_checked_at`. 0 are at `status = 'verified'`.** Every row names a rule and not one links to it. `AUDIT-CHECKS.md` check 1. |
| **Agency list** (`agencies`) | ✅ working | 12 Sep | **33 agencies in both environments** — 14 federal, 16 Oregon, 3 local. Shared regulators carry both industry slugs; none is duplicated. `url` is NULL on every row **deliberately** — an unverified link is the fact class `CLAUDE.md` §6 says must carry a badge, and this table has no badge column (`TODO.md` 2.1). Washington's regulators are absent on purpose (`DECISIONS.md` §32). |
| **Requirement → agency assignment** | ✅ working | 12 Sep | **187 of 194 requirements carry a regulator**, from a reviewable mapping table (`supabase/seed-data/agency-mapping.json`), identical in both environments. **The 49 Oregon rows citing 29 CFR resolve to Oregon OSHA, not federal OSHA** — the line the whole mapping exists to get right. 7 are deliberately NULL: 3 contractual, 2 genuinely ambiguous, 2 with no enforceable citation. |
| **Coverage table** (`industry_coverage`) | 🟡 degraded | 12 Sep | **56 rows in both environments, all `not_built`, 32 of them with nothing behind them.** The data is right and **nothing renders it** — no reader exists outside the loader, so the coverage strip `CLAUDE.md` §6 describes does not exist. Degraded rather than working because the honest signal is computed and invisible. `row_count` counts live rows only (`AUDIT-CHECKS.md` check 4). |
| **Switch library** (`switches`) | 🟡 degraded | 12 Sep | **95 switches in both environments, 40 dependency edges, 0 cycles, graph walked from each database and compared** — 95 nodes reached, 55 roots, 40 children, max depth 1, depth maps identical. 73 site-scoped, 22 company; 6 numeric carrying their thresholds. Derived from 188 requirement trigger strings rather than from the design document — `DECISIONS.md` §36. **Degraded on one axis that is now measured: 42 of the 95 — 44.2% — have NO determination path even after Phase 7.2 ships** (29 need an ask path, 11 need signup to collect them, 2 need 6.3b wiring). `AUDIT-CHECKS.md` check 23. **12 of the 95 are referenced by no requirement condition**; 4 of those are context rather than triggers, 8 are the 6.3b backlog. |
| **Requirement conditions** (`applies_expression`) | ⛔ broken | 15 Sep | **22 of 216 switch clauses can never be true** — 17 compare the `hazwaste_generator_category` enum against boolean `true`, so **a large-quantity generator receives zero hazardous-waste obligations** and is told so confidently. Plus **25 distinct rows of 205 carrying two enumerable shapes** (check 30): 4 gated on a determination result wearing the shape of a fact, and 21 state rows whose expression is identical to a federal row's — **14 of those are harmless tautologies, 7 are the defect. 11 rows need judgement.** Bounded wider: **60 state rows cite a CFR and 39 carry no Oregon clause at all.** Neither shape is fixable without 6.7 — `citation_quote` is NULL on all 205. |
| **Resolution engine** (`lib/resolve.ts`, `lib/jurisdiction.ts`) | ✅ working | 13 Sep | **Layer 3, and it contains no AI. Wired to a route as of 13 Sep** — `/api/obligations` computes on the first GET and persists through `close_and_replace_obligations`. Jurisdiction + switches + library → obligations, deterministically. Six-case match key as a pure predicate; company-level expressions evaluated once per site and combined with a three-valued existential; `unknown` never resolves to `does_not_apply` anywhere in the chain. **250 tests across the suite, and all nine of the engine's safety properties proved by breaking them** — `npm run mutation` applies nine plausible wrong implementations and all nine are caught. |
| **`close_and_replace_obligations`** | ✅ working | 13 Sep | **In both environments (016), amended on staging by 023.** Closes changed or departed obligations by setting `applicable_to` and inserts the new ones, in one transaction — **no DELETE**, because obligations are history (`DECISIONS.md` §47). **13 Sep: EXECUTE granted to `authenticated` with a caller-identity guard inside** — a signed-in user passing another company's id is refused by name (`caller belongs to company X, not Y`, verified live, the other company's 221 obligations unchanged after the attempt). RLS is what makes that safe; the guard is what makes it legible. `anon` holds nothing. **An empty payload is valid and always was**: every guard counts rows and gets zero, the close closes what is open, the insert inserts nothing. Exercised on **staging only**. |
| **The workspace page** (`app/compliance`) | ✅ **live through Stage 4** | **4 Oct** | **4 October 2026: rebuilt in the Audits shell and live through Workspace Stage 4** (`DECISIONS.md` §153–§163; element by element in `docs/HANDOFF-WORKSPACE.md` v7). The text below is from 23 September. **§126 rebuilt it from the prototype; §127 and §129 fixed what the owner's test passes found, and it is LIVE ON PRODUCTION.** Markdown renders, `[n]` opens a source card, junk source titles fall back to a URL-derived name. Fixed since: **a stream that ends without `done` now says the answer stopped early and offers Try again** (it was shown as finished, §127 A); **a citation marker inside a table no longer cuts the table in half** (§127 D); **Download inside a drawer prints that drawer** with a company/title/date header (§127 E); **an attached file now reaches the model** (§129). **Known limitation: `outcome: 'ask'` is still not handled**, so neither gate can be switched on before R1.5 (`components/archive/GateAskCard.tsx`). |
| **Attachment in a conversation** (`lib/attachedDocument.ts`) | ✅ working | **23 Sep** | **§129 — a file attached in a conversation is part of it.** The rebuilt page uploaded, filed and reviewed a document and then sent nothing to the model, so the next question was told no file had come through. The document now travels **by id**, is loaded from storage as the caller, and reaches the model as the same native block the review path sends — for a PDF, **the raw PDF, not extracted text**. `turns.document_id` / `document_name` persist the link (migration 039, on both databases); the NAME is a copy so a transcript survives the document's deletion. Carried on **every** turn, capped at 3 — carrying only the review summary made a later turn **retract a true finding**. Proved by `npm run check:live -- --only attachment`: **7 of 7 planted errors named**, tier worked across both locations. |
| **Cost ledger** (`ai_calls`, `npm run cost`) | ✅ working | **23 Sep** | **§128 J — one row per model call, written at the call, with the prices it was costed at** so a later price change cannot rewrite what a past call cost. **78 rows on staging.** Split: research 83.7%, checklist 12.1%, convert 4.1%, summarise 0.1% — and the split a per-task view hides, **input 58.1% against output 34.1%**: the expensive half is what we send. `cost_usd` NULL means UNPRICED, never free. `config/pricing.ts` was **owner-verified 23 Sep** after its first version was wrong by ~2.8×. **🟡 on coverage rather than on function: 6 of 10 tasks have never written a row** — see the known gap below. |
| **Conversations** (`turns`) | ✅ working | **23 Sep** | **§125 — a conversation survives the tab.** Each exchange saved as it completes: the question when it arrives, the answer when the stream ends with its sources. Title is the first question verbatim. A stopped answer keeps the question, marks it, writes no answer row and does not move the counter. `authenticated` holds SELECT+INSERT and **no UPDATE** — a user cannot rewrite what the transcript says they asked — so `stopped` is set by the service role. Reopening works through `GET /api/topics/<id>`, and **a follow-up with no client history falls back to the stored turns** (before that it answered *"I don't have the earlier part of our conversation"*). |
| **Usage counters** | ✅ working | **23 Sep** | **§125 — events, not inventory.** Never decremented, never derived from row counts: transcripts are cleared *(12 months after the last message since Workspace Task 2, 3 October 2026; it was 7 days when this was written)* and checklists can be deleted, and a `count(*)` would tell a customer who asked forty questions that they asked six. Incremented by an atomic database function (PostgREST cannot express `col = col + 1`), whose EXECUTE is revoked from PUBLIC in the same migration. Proved: answer +1, stop unchanged, delete a checklist unchanged. |
| **Nightly jobs** (`/api/jobs/*`) | ✅ **live on production from the cron release** (Workspace Stage 4 Part 3, `14eb03b`; the sweeps show GET 200 in Vercel, the owner's map; an empty sweep writes no `job_runs` row, `57c754c`) | **4 Oct** | **The cron release, 4 October 2026 (`DECISIONS.md` §162):** each job answers Vercel Cron's GET with `Authorization: Bearer <CRON_SECRET>` as well as POST with `x-cron-secret`; proven on staging on all four jobs; on production it is proven by the next morning's `job_runs` rows (`docs/TESTING.md`, "The cron release"). Before it, as corrected on 4 October: Vercel's cron calls them with GET and the routes answer POST only, so every scheduled call is refused with 405 and production `job_runs` has never held a `summarise` or `delete` row (`DECISIONS.md` §154; `docs/HANDOFF-CODE.md` §7, *Cron jobs never run*). They work when called by hand with `x-cron-secret` — the summarise job was run so on staging on 4 October (`DECISIONS.md` §161), which also gave it the 24-hour quiet rule on both lists, a claim per topic and a conditional save. The text below is from 23 September. **§125, §116's gates 1 and 2.** Vercel Cron, two protected routes, **no worker**. They refuse when `CRON_SECRET` is UNSET rather than when it mismatches, and answer 404 so the route cannot be confirmed to exist. Summariser writes the summary, proposes facts into `fact_proposals` and **never writes `company_switches`** (§108); it never overwrites a user's summary without newer turns. Deleter clears transcripts, keeps topic and summary, and carries a **30-day backstop** so a summariser outage cannot make transcripts permanent. One `job_runs` row per run, counts by topic id. |
| **Conversation → checklist** | ✅ working | **23 Sep** | **Live on production, 4 October (Workspace Task 6, `DECISIONS.md` §157):** three groups; "Just what we discussed" held to the summary's citation check; "Everything on this subject" searches the web, at most 8 searches, and an added item's link must be one the search returned. The text below is from 23 September. **§125 — scope and provenance.** `discussed` may cite only sources the conversation already cited, **enforced in code after the call** and items citing anything else are dropped and counted. `complete` adds the rest as `origin='added'`. Title names the scope; `from_topic_id` is stored, ON DELETE SET NULL so clearing a transcript never deletes the checklist. **§111's obligation link stays deferred** — `origin` is provenance, not authority. |
| **Research answer** (`/api/chat` research) | ✅ **live on production** | **23 Sep** | **§123's open baseline, plus three measured switches and the effort decision.** One open streaming call: role sentence, search the model decides on, history as plain pairs. **Effort is `medium` by default** (§128) — measured 43% faster and 42% fewer output tokens than `high` at the same golden-fact score. Three switches are ON locally and **unset in production**, each shipping only on the owner's comparison: `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST`, `RESEARCH_PROVENANCE`. History now carries each earlier answer's numbered sources (§127 C). **Golden facts: 8 of 8 on the owner's five questions**, three runs each (`npm run golden:facts`). **Answer QUALITY is still the owner's to judge** against an incognito chat (§115). |
| **Checklist answer** (`/api/chat` checklist) | ✅ **open baseline** | **22 Sep** | **Live on production, 4 October (Workspace Task 6):** the shape gains the `to_confirm` group. The text below is from 22 September. **§123 — the same open call, and a SHAPE rather than a fence.** The prompt is the role sentence plus the output shape and nothing else; `cost_note`, `providers` and `safety_alert` are gone from it as slots the model fills because they exist (§113), and stay optional in the type because 235 production items carry them. Driven as `testgamma`: 8 `must_do`, 7 `good_to_have`, shape intact. Gate and critic sit behind `CHECKLIST_GATE` / `CHECKLIST_CRITIC`, both off. **Still writes checklist rows with no link to an obligation — §111's hybrid is NOT built.** |
| **"How do I do this?"** (`/api/checklist-items/[id]/how-to`) | ✅ **live on production, 4 October** | **4 Oct** | Workspace Task 6, `eec4d22`, `DECISIONS.md` §157: one item researched with web search, every step's URL checked against this call's search results, labelled official or other; one click one call, claimed in the database. Three runs on Opus 5.5 on staging. **Live on production, 4 October** (the Task 6 release, `a701436`; migration 064 applied). The owner's paid check on production: MNBP registration, 7 steps, all official, printed correctly (`DECISIONS.md` §158). |
| ~~**Micro-steps** (`substeps`)~~ | ⛔ retired 4 Oct (Workspace Task 6) — the page never generates or shows them; stored rows untouched. Row below kept as written | **22 Sep** | **§123 — generated in the BACKGROUND after the list renders, at most 3 in flight.** Was serial and on-demand, so every first expand waited on a model call. **Never lost, never repeated**: the enqueue condition is absence from storage, so restored items are skipped forever and unfinished ones resume next open. They **inherit the parent item's sources and carry none of their own**. Stored as today, by `parent_item_index`. |
| **Critic pass — coverage** | ✅ working | 13 Sep | **Routed since 12 Sep** — `/api/chat:184` (and `/api/audits:427` until Run 3 deleted it) — and **tested since 13 Sep: 24 assertions** over `normaliseCritique` and `applyCritique`. It had none before because it could not be IMPORTED by one: `@/lib/...` is resolved by the bundler and by `tsc`, **not by Node's loader**, which runs the suite (`DECISIONS.md` §67). Three files were in that state — `documentReview`, `determinationGate`, `documentContent`; `documentReview` is deleted (Run 3, 30 September 2026), leaving two. **Latency untouched and it is M1's real risk: 84 s average, 37–151 s**, because Stage 2 does not exist to narrow 33 agencies. |
| **Chemical inventory** (`company_chemicals`, `regulated_substances`) | 🔧 not-yet-rebuilt | 12 Sep | **Both tables exist in both environments and both hold 0 rows. That is the expected state, not a gap.** `regulated_substances` is reference data keyed by CAS number — EHS, TRI, PSM, RMP and CERCLA thresholds — and is not seeded yet; `company_chemicals` is per-customer inventory and there are no customers. **With both tables empty, `substance_inventory()` returns `unknown` — not `false` — for every site, verified against the function body rather than assumed:** the first branch is `when not exists (… company_chemicals …) then null`, because a site nobody asked is not a site below the threshold. And once customers exist but `regulated_substances` is still empty, every inventory row matches no substance and is therefore unevaluable, which lands on the same `null`. **There is no state in which an unseeded reference table produces a clear.** Seeding it is 6.4. 15 of the 199 conditions depend on it. The tables are here already because migration 014's semantics — an unidentified chemical makes the answer **unknown**, not false — had to be designed before any data arrived, not retrofitted after (`DECISIONS.md` §45). |
| **Critic pass** (Stage 5) | 🟡 degraded | 12 Sep | Working and correct; **degraded on latency, and the cause is structural rather than a tuning problem.** Measured across 12 runs: **84s average, 37–151s.** It is the most expensive call in the product — more than generation (30s avg) and the gate (6–10s) combined. **The cause is that it is handed all 33 agencies with jurisdiction, because Stage 2 does not exist to narrow the list to the ones this question touches** (`docs/CRITIC-PASS.md` §5). **Do not optimise the prompt or lower the tier — narrowing the input is the fix, and it is Stage 2's job.** Other detail below. |
| **Critic pass — detail** | ✅ working | 12 Sep | **Live on `/api/chat` checklist mode**, on the strongest model tier. It was also on `/api/audits` until Run 3 retired that route (30 September 2026); the audit section's own critic pass is not built. A fresh call that sees only the output — never the prompt that produced it. **It never rewrites**: findings are applied in code by severity, so a wrong item is withheld with its reason rather than regenerated (`DECISIONS.md` §39). Verified against the frozen 2.5L artifact in `baseline-outputs/`: 13 findings, 7 blocking, all seven known errors caught plus four nobody had recorded. Negative control held — 0 blocking on a verified-correct answer. Not yet exercised by a person. |
| **Model tier routing** | ✅ working | 12 Sep | `judgement` · `critique` · `prose` · `default`, private to `lib/ai.ts`. **And it surfaced a latent bug**: the Claude 5 family rejects `temperature` outright, six call sites pass it, and `AI_MODEL=claude-sonnet-5` would have 400'd all six. The pipe now drops the parameter where it is not accepted. `AUDIT-CHECKS.md` check 15. |
| **Determination gate** (Stage 1) | 🟡 degraded | **28 Sep** | **6–10s, the cheapest stage.** **⚠ CORRECTED 28 SEPTEMBER: it is NOT live on `/api/chat`.** This row said "Live on `/api/chat` and `/api/audits`" from 12 September. On `/api/chat` the gate is behind `RESEARCH_GATE` / `CHECKLIST_GATE` (`app/api/chat/route.ts:287–291`), and **both are deliberately unset on production** (`docs/RELEASE.md`, `lib/pipelineConfig.ts` — every switch defaults OFF and an unset variable IS the behaviour), so the gate does not run there at all. ~~On `/api/audits:238` it is called unconditionally, with no switch — which makes the audit engine the only place in the product where Stage 1 runs on production.~~ **THAT CALLER IS GONE — 30 September 2026, Run 3.** The audit engine was retired and its route deleted, so once this is pushed **the determination gate has no unswitched caller on production at all**: `/api/chat` keeps it behind `RESEARCH_GATE` / `CHECKLIST_GATE`, both deliberately unset. Stage 1 is built, tested by `npm run golden`, and reaches no customer until a switch is turned on or the Audits section calls it. That is a bigger change to this row than the deletion looks: the gate went from running on every production audit to running nowhere. And `outcome: 'ask'` **cannot be rendered there**: the route returns `{ outcome: 'ask', ask }` with no `data` key (`:247`) and the page reads `json.data` (`app/audits/page.tsx:132`), so an ask shows a blank screen with no error. **28 Sep, Task 0:** a two-site company's site-scoped switches now render with their site — before this the block carried seven pairs of bare contradictions (`Employees at this site = 1` beside `= 6`) under a heading telling the model to treat them as settled. **12 Sep: the facts it establishes now reach the generating call** — until then `g.resolved` went into the HTTP response and nowhere else, so the model writing the answer was never told what the gate had determined (`DECISIONS.md` §41). Before any answer it decides what facts the question turns on and asks for one if a blocking fact is missing. Verified against staging by `npm run golden`: the 2.5L bottle case asks for the SDS; the Oregon minimum-wage case proceeds without asking, treating jurisdiction as already known. `substeps` is deliberately not gated. Not yet exercised by a person — `docs/TESTING.md` has the manual set. |
| **`company_switches` / candidates / jobs** | ✅ working | 13 Sep | **16 rows on staging for Test Alpha across 9 distinct switches, all `source = user_set` and `state = known`** — written by the ask path, not by a seed. Test Beta has 0 and still resolved correctly, which is the zero-facts path working. **Production holds 0, correctly**: no customer has answered anything. `library_candidates` and `jobs` remain empty with no caller, waiting on Phase 5. |
| **Obligation writer** (`lib/obligationWriter.ts`, `/api/obligations`) | ✅ working | 13 Sep | **Phase 4.3, exercised end to end through the route by a person** — `TESTING.md` Cases E and F pass. On **Test Beta Cannabis** the first GET computed, wrote the timestamp, and closed the pre-existing hand-seeded obligation rather than deleting it: **open 0, closed 1**, which is Case F proved in the data. Beta resolves to **zero** obligations (all 200 live library rows are `chemical-manufacturing`), so the *"we worked it out and found none that apply"* empty state rendered for the first time. On **Test Alpha**: 221 open, 16 facts, idempotent on reload. Until 023 it had never run through its own route at all (`DECISIONS.md` §63). **023 is now on both environments.** |
| **Multi-facility structure** | ✅ working | 11 Sep | Every company has exactly one primary site, **in both environments**. Production's 10 were backfilled by 010 and the trigger is armed, so a new company gets its site in the same statement that creates it. Sites carry their own state, county, city and fire authority. |
| **Worker** | ⬜ not built | — | Phase 5. The `jobs` table exists; nothing polls it. |
| **Switch determination + ask path** (7.2 / 7.2a) | ✅ working | 15 Sep | **Both routes exist and have been driven over real HTTP as a signed-in user.** `GET /api/switches/ask` returns three states — **49 ready · 31 blocked · 14 absent of 95** — and no total (§58.3). `POST /api/switches/answer` writes three things in FK order and returns what moved. **Eight guards probed over the wire**: 401 without auth, 400 on a missing value, **404 (not 403) on another company's entity**, 400 on a site-scoped switch with no site, 400 on a bad enum. **Two of the first probes passed for the wrong reason and were re-run** (§81). `switchAsk` and `basis` are now reached; **`sdsExtraction` remains unrouted** (check 29). |

## Known-wrong, whole-product

These are true regardless of which screen you are looking at.

- **~~THE DOCUMENT-REVIEW PATH SPENDS MONEY NOTHING COUNTS.~~ GONE — 30 September 2026.**
  `lib/documentReview.ts` called `askAIJson` with no `ledger:` argument, so its spend was real and
  missing from every figure the cost report produced. **The file is deleted** (Run 3), along with
  `app/api/audits/route.ts`, `prompts/audit.ts` and `prompts/document-review.ts` — the only caller
  and the prompts it used. There is no unledgered call site left on that path because there is no
  path. The `audits` and `hr_audits` tables are kept: they hold what customers were shown.
- **No county-scoped requirement can resolve for anyone.** `jurisdiction_layer = 'county'` is a
  value the match key must serve, and signup hardcodes `county: ''` and never asks. Until
  M7's signup rework geocodes the address (`DECISIONS.md` §25.1), those rows cannot apply to
  anybody. 2 of production's 10 companies have a NULL county today, and the other 8 were
  hand-typed in three different capitalisations — which is the argument for geocoding.
- **No `local` fire-code requirement can resolve either.** `entities.fire_authority` is unset
  on all 10 production sites, correctly: it is asked, never derived, because fire districts
  do not follow county lines (`DECISIONS.md` §25.2). Until M7 asks, those three rows show as
  undetermined rather than resolving against a guess.
- **No user management.** A person cannot be added to a company or removed from one. When
  an employee leaves, their login keeps working indefinitely with full access. Needs no
  migration — only an invite flow (`TODO.md` FEATURE, `DECISIONS.md` §19).
- **Two file pickers are still narrower than the routes behind them.** `/calendar` offers no
  images though `/api/extract-dates` reads them; `/audits` offers no Excel, CSV or
  PowerPoint though the scan reads all three; `/hr` offers `.pdf,image/*` though
  its route now reads everything. Only `/documents`, `/compliance` and `/upload` were
  widened on 11 Sep. Recorded in `TODO.md` M4.
- **Three API routes still have no session check.** `/api/extract-dates`, `/api/feedback` and
  `/api/scan-website` are reachable by anyone. **`/api/chat` was the fourth and was closed on
  11 Sep** — not as security housekeeping but because the determination gate has to read
  `company_switches`, and a route that does not know who is asking cannot avoid asking the
  same thing twice. `/api/industries` and `/api/signup` have no check **deliberately**: both
  serve the pre-login signup page (`TODO.md` §0.9).
  **The sharpest of the three is `/api/scan-website`**, which takes a URL from an
  unauthenticated body and fetches it plus sixteen guessed subpaths. `/api/feedback`
  interpolates caller input into an HTML email with no escaping. `TODO.md` §0.8b;
  `DECISIONS.md` §35.1 records that an earlier note claimed this work closed four routes
  when it closed one.
- **Key rotation outstanding.** Six credentials. Item 1 of the gate, and the only gate item
  still open. **A production service-role key was echoed into a session transcript on 11
  Sep**; rotation is deliberately batched with the other five rather than done twice, and
  the condition is *before the first real customer document*, not a date (`TODO.md` §0 gate).

## Two tables are empty on purpose, and they are not the same kind of empty

**`obligations` — 0 rows in both environments.** Migration 007 dropped the 376 that existed,
because they were pure derived output (188 templates × 2 companies) carrying the jurisdiction
defect. **Nothing regenerates them until the resolution engine exists at Phase 4.1**, and
nothing should: obligations are code's output, never AI's (`CLAUDE.md` §1, layer 3). The
requirements screen renders empty as a direct consequence. **Expected, not a regression.**

**`company_switches` — 0 rows in both environments.** This one is empty for a different
reason: it is **not seeded at all, ever**. The 90 rows in `switches` are the *vocabulary* —
which facts exist, how to ask about them, what they depend on. `company_switches` holds one
company's *answers*, and those are established at runtime by the determination gate, by
document reading, or by a user overriding. It fills one fact at a time as people use the
product. **A seeded `company_switches` would be inventing facts about real companies**, which
is the omniscient status tracker in its most literal form.

The practical consequence today: **the gate has no memory across sessions.** It cannot know a
fact was established last week, so it re-asks. That is `DETERMINATION-GATE.md` §7's
persistence bound not working yet, and it is waiting on the first writes rather than on code.

## How to keep this honest

Update it when a module's state changes, **and when a rebuild makes something stop
working on purpose** — that second case is the whole reason it exists. A line saying
"verified 10 Sep" a month later is not a claim that it works; it is a claim that nobody
has looked since.
