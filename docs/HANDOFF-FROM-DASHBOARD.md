# Handoff — from the Dashboard section

**Version:** 1 · **Updated:** 20 October 2026, by the Dashboard chat at the close of the Dashboard's build
(`docs/DASHBOARD-PLAN.md` step 10).
**Supersedes:** nothing. This is the close-out file `docs/DASHBOARD-PLAN.md` step 10 calls for; it is written in the
shape of `docs/HANDOFF-FROM-CALENDAR.md`, which is the file to read beside it.
**For:** the next section's chat (My Account), any later Dashboard chat, and Claude Code. Read it first, then the
files it points to.
**Checked against:** the repository at `f4e09d4` (20 October 2026), `npm run preflight` against production, and the
production and staging reads quoted below. **Where this file and the repository disagree, the repository wins: say
so and correct this file.**

---

## 0. In one paragraph

The Dashboard is **live on production** at `https://compliboard.vercel.app/dashboard`, and **logging in lands there**
— until 20 October it landed on the marketing homepage. It shows, in this order: a welcome that knows whether this is
your first visit, four numbers that only ever go up, one question at a time with a sentence saying what counts,
the dates due in the next 30 days, and the last three audits. **No model is called anywhere on the page**, so every
test of it is free. Three of the four numbers are now kept by **database triggers** rather than by routes, because
four routes could insert a checklist and only two remembered to count it. Migrations **080 and 081 are on
production** (`npm run preflight`: `PENDING COUNT: 0` after the release). The release went out as `3c2c2bf` on
20 October and a hotfix followed the same day as `f4e09d4`: a report opened from the address could not be closed, a
bug that `next dev` cannot reproduce. §7 lists what is owed.

---

## 1. Read these, in this order

| File | Why |
| --- | --- |
| `CLAUDE.md` | The project rules. §3.4a (the `npm run haiku` guard), §3.6 (RLS is the boundary), §3.7 (production is SELECT only), §3.11, §9.1, §9a |
| `docs/DASHBOARD-PLAN.md` (v3) | The plan: 12 decisions, the steps and what each proved, the parked items, the change log |
| `docs/DECISIONS.md` §203–§206 | Every Dashboard decision and migration, what was proved, and its effects on other sections by file |
| `docs/dashboard-boards.html` | The owner's four boards. Every screen was drawn here before it was built, and the words on them are his |
| `docs/DASHBOARD-MACHINERY.md` | The read-only map of 19 October: what the Dashboard was before this section began, with file and line. Its findings are cited all through the decisions |
| `docs/TEST-AT-FINISH-LINE.md`, the Dashboard part | Everything the Dashboard leaves for the end |
| `docs/TESTING.md` | The Dashboard's tests by file, and **the production-build rule the hotfix bought** |
| `docs/RELEASE.md` | The Dashboard's own release routine, marked as run on 20 October |
| `docs/HANDOFF-CODE.md` §7 | Open defects and owed work, the Dashboard's among them |
| `docs/HANDOFF-FROM-CALENDAR.md` | The section this one copied: the frame, the 900 column, `liveDates`, and the drawer the Dashboard links into |

---

## 2. Where the Dashboard stands

**Live on production.** `main` is at `f4e09d4`; production holds migrations `000`–`081`.

| | |
|---|---|
| The page | `app/dashboard/page.tsx`, 352 lines, `'use client'` |
| The frame | `components/AppLayout.tsx`, imported. The 900 column (`:231`), the same one `/hr`, `/calendar` and `/compliance` take |
| It prints | nothing. Decision 11 — no `print-page`, so it stays out of the print frame |
| Model calls | **none, anywhere on the page or in anything it calls** |
| Writes | **one**: `welcomed_at`, once, on a person's first visit (`app/dashboard/page.tsx:199`) |

### 2.1 What it shows, in order

1. **The welcome**, as the page title (`:235–236`). `welcomeFor()` in `lib/dashboardView.ts:41`.
2. **The four numbers** (`:244`), one row of hairline cells, from `usage_counters` and nothing else.
3. **The three questions** (`:261`), `components/DashboardQuestions.tsx`.
4. **Upcoming in the next 30 days** (`:264`).
5. **Recent audits** (`:330`).

### 2.2 The four counters, and the five triggers

The numbers are `usage_counters.files_read`, `questions_answered`, `audits_done`, `checklists_created`, read with the
caller's own client at `app/dashboard/page.tsx:172`. `authenticated` holds SELECT on the table under one policy —
`usage_counters_select_own_company`, `using (company_id = auth_company_id())` — so no route was added.

**Three of the four are kept by the database** (migration 080). The triggers, read from the production catalog on
20 October:

| on table | trigger | when |
|---|---|---|
| `document_scans` | `document_scans_count_reading` | AFTER INSERT, `new.status IS DISTINCT FROM 'could_not_read'` |
| `audit_runs` | `audit_runs_count_done_insert` | AFTER INSERT, `new.status = 'done'` |
| `audit_runs` | `audit_runs_count_done_update` | AFTER UPDATE, `old.status IS DISTINCT FROM 'done' AND new.status = 'done'` |
| `checklists` | `checklists_count_created` | AFTER INSERT, unconditional |
| `profiles` | `profiles_person_update` | BEFORE UPDATE → `profiles_guard_person_update()` |

All four counter functions and `bump_usage_counter_for(uuid, text)` are **SECURITY DEFINER** with
`set search_path = public, pg_temp` and `revoke all ... from public, anon, authenticated`; they write a table the
caller holds no INSERT on. `profiles_guard_person_update` is deliberately **not** definer — a guard runs as the
caller — and `profiles_person_welcome_refusal(timestamptz, timestamptz)` is a pure `sql` function.

**`questions_answered` is the one still counted in code**, by `bumpCounter` at `app/api/chat/route.ts:510`. Decision
3: a stopped answer must not count, and all three chats already get that right; a trigger on a turn table could not
tell a finished answer from an abandoned one.

### 2.3 The welcome and `welcomed_at`

`profiles.welcomed_at timestamptz` (080). Null means this person has never opened the Dashboard.

- `welcomeFor(full_name, welcomed_at)` returns the title, the lede, and `firstVisit`. Four cases, all tested.
- The page writes `welcomed_at` **after it has drawn**, once, through the caller's own client on 080's column grant
  (`app/dashboard/page.tsx:199`). A refusal is swallowed: the title is already right for this view.
- **The database enforces the rule, not the page.** `profiles_person_welcome_refusal` refuses any change to a
  `welcomed_at` that is already set — including clearing it — with *"Your first visit is already recorded and is not
  changed here."* Proved on staging as a signed-in person: set → OK, set again → refused 23514, clear → refused 23514.
- **Only the service role can clear it.** So a first-visit test has exactly one chance per person. See §6.

### 2.4 The three questions, and their one route

`components/DashboardQuestions.tsx`. Decision 8.

- The list comes from `GET /api/switches/ask` → `askableSwitches()` (`lib/switchAsk.ts:138`).
- **Company scope only.** The route does not filter by scope — `askableHere()` in `lib/dashboardView.ts` does. 73 of
  the 95 switches are site-scoped, and a site question on a page that names no site would have to pick a site, which
  `DECISIONS.md` §20 forbids.
- The words are the switch's: `question_plain`, and since 081 `help_plain` under it.
- The control comes from `value_type`: boolean → two buttons, number → a box and Save, enum → one button per option
  **drawn from `allowed_value_labels`**. A type none of those fits is skipped.
- **One writer.** Every answer goes to `/api/switches/answer` through `lib/switchAnswer.ts` — the same body shape
  Company information's route proxies with. The route writes `switch_determinations`, then `company_switches`, then
  recomputes obligations. **It calls no model**: nothing in its import closure reaches `lib/ai.ts`, and a test walks
  that closure.
- **"Three today" is counted, not stored.** `switch_determinations` with `source = 'user_set'` at or after the
  **browser's local midnight**, sent as an absolute instant. A UTC day would end an Oregon person's quota at four in
  the afternoon.
- **A skip writes nothing anywhere.** It lives in `localStorage` keyed by the local date, every read and write in
  try/catch, and the page works with storage absent or throwing — the cost is one repeated question. A skip does not
  advance the number, because a skip is not an answer.
- **Nothing says what an answer did.** The route returns `unblocked` and an obligation delta; the card ignores both.

### 2.5 Upcoming

`readCalendarRows(supabase)` — the Calendar's own call, which is `liveDates` with the view's full column list
(`lib/calendarView.ts:84`). The same call `app/calendar/page.tsx:237` makes, so the two cannot disagree about what is
on the calendar. The 30-day filter is `inNext30Days()` and reads only columns the VIEW computed; nothing here touches
a clock. Six rows, then "N more in the next 30 days." A row opens the Calendar's drawer at
`/calendar?tab=calendar&date=<id>`.

**The rows are the Calendar's, not a copy**: `metaParts`, `whenWords`, `passedWords`, `siteWords`, `longDay`. The
Dashboard phrases none of it.

### 2.6 Recent audits

The last three `audit_runs` with `status = 'done'`, newest by `finished_at`, read as the person under
`audit_runs_select` (`company_id = auth_company_id()`). **Nothing is said about `dismissed_at`** — dismissing clears
a banner on the Audits page, it does not un-run the audit (decision 7). A run is named by `runName()` in
`lib/auditView.ts:49`, the same function the Audits page uses. A row opens `/audits?run=<id>`.

**Open question 2, answered: HR's handbook audits are NOT `audit_runs` rows.** They are `handbook_checks`
(`lib/handbookCheck.ts:131`), with their own sections and findings tables, and `audit_runs_kind_check` allows only
`'agency'` and `'template'`. So this section shows compliance audits only.

### 2.7 The sidebar (decision 12) and the breadcrumb

`components/AppLayout.tsx:56` `NAV_ITEMS`. Order: Dashboard · Compliance Workspace · Audit Workspace · HR Workspace ·
Calendar · Documents — **a hairline** — Company information · My Account. Everything above the line is somewhere a
person goes to do the work; the two under it are the record of who they are.

- **Two words changed and no href did.** "Audits" → "Audit Workspace", "Company Documents" → "Documents". `/audits`
  and `/documents` are untouched, so every link, bookmark and test still works.
- **The green box is gone.** The active page is marked exactly as a workspace marks its active tab, with the two
  tokens read off `components/Tabs.tsx:22` rather than chosen: the word in `--green-ink` at weight 500, a 2px
  underline in `--green`, offset 6px. Read back from the browser: nav active `rgb(37, 101, 65)` w500, underline
  `rgb(47, 125, 82)` 2px — and `/hr`'s active TAB is the same two colours.
- **The pill is gone.** A count is a plain 12px tabular number in gray-400, shown only above zero.
- **The breadcrumb is gone.** It drew `/ Dashboard` and `/ My Account` and only those two — six of the eight
  signed-in pages passed no title, so the bar said where you were on a quarter of the product. The **markup** was
  removed rather than the prop, so no page can bring it back; the prop survives because `document.title` reads it
  (`components/AppLayout.tsx:185`), and that is now all it does.
- Measured before and after on all eight signed-in pages: **title x and column box unchanged on every one**, sidebar
  box `0–224 (224)` unchanged, top bar 57px and the logo at 16–125 unchanged.

---

## 3. What changed outside the Dashboard, and the proof for each

| What | Where | The proof |
|---|---|---|
| **The `profiles` UPDATE grant narrowed** | migration 080 | `authenticated` held **table-wide UPDATE** and the policy had no `WITH CHECK`, so a signed-in person could move their own `company_id` to another company's. Read on production before the release: `has_column_privilege(…,'company_id','UPDATE')` **true**. After: **false**, with UPDATE granted on `(full_name, welcomed_at)` only and the `WITH CHECK` in place. Proved as a signed-in person on staging: writing `company_id` is refused **42501, "permission denied for table profiles" — the grant, not the policy** |
| **The checklist counter moved into the database** | 080, plus two bumps removed from `app/api/chat/route.ts` and `app/api/checklists/from-topic/route.ts` | Four routes insert a checklist and only two counted. A trigger cannot be forgotten by a fifth |
| **A date's state leads its meta line** | `lib/calendarView.ts:275` `metaParts` | Cascade's rows read `31 October 2026 · Certificate of Annual Maintenance, … Portland Facility · no…` — the `truncate` had eaten **"not confirmed"**, the one part saying the date is not yet a fact, and the Calendar's own list was doing it too. Now `not confirmed · 31 October 2026 · …`. **This changes the Calendar's list as well, deliberately** |
| **`lib/auditView.ts`** | new | `runName` and `checklistTitle` moved out of `app/audits/page.tsx` unchanged, so the Dashboard and the Audits page cannot call one run two things. The Audits page imports them; its three call sites behave as before |
| **`lib/switchAnswer.ts`** | new | One typed body for "a person answered a switch". `entity_id` is the field a second copy quietly omits |
| **The measuring tool can see four more things** | `scripts/measure-layout.mjs` | **The column on a page that does not print** (it found the column by `.print-page`, which decision 11 keeps off the Dashboard, and reported "no .print-page" over a column plainly there); **the sidebar** — its box, every item's y, colour, weight and underline, and the hairline found by shape; **the top bar** — height, the logo's box, the breadcrumb's box. Each was added **before** the baseline run it was needed for, so before and after are read by the same instrument |
| **Escape closes any drawer** | `components/Drawer.tsx:75` | There was no key handler at all. One listener, so **every drawer in the product** answers Escape now: the Calendar's date drawer, Documents' and Audits' reports, HR's handbook check |
| **The hotfix** | `f4e09d4`, `app/audits/page.tsx` | See §4 |

---

## 4. The hotfix, and the rule it bought

**A report opened from the address could not be closed.** `/audits?run=<id>` opened the drawer and the X did nothing.
Found by the owner in the step 9 live checks, on production.

**The cause.** The page derived the open drawer from the address — `openRun = params.get('run')` — and closing it
removed the only parameter and asked the router for the bare `/audits`. **`router.replace` does not navigate to the
bare path of this prerendered route**: `useSearchParams()` kept returning `run=…`, so the drawer re-rendered open.
Measured on one production build of the tree:

```
/audits?run=<id>                  → X → address UNCHANGED, drawer still open   ← the bug
/audits?tab=past&run=<id>         → X → /audits?tab=past, drawer closed        ← a parameter remained
/calendar?tab=calendar&date=<id>  → X → /calendar?tab=calendar, closed
```

**The Calendar escaped it by accident**: `closeDate` keeps `?tab=`, so its query is never empty. A trailing `?` was
tried and changes nothing. **And the same line broke the tab**, unnoticed: "Where you stand" from `/audits?tab=past`
also removes the only parameter, and on the same build the address did not change and the page stayed on Past audits.
One cause, two controls; only the drawer was reported.

**The fix.** `run` and `tab` are state seeded from the address, and an effect follows the address only when the
**parameter** changes — never on a re-render. `setParam` keeps its one-call API so no other line on the page changed:
it moves the state first, then writes the address with `router.replace` while a parameter remains and
`history.replaceState` for the empty case the router refuses. A `searchRef` holds what the page last wrote, because
after a manual write the router's `params` is stale and the next tab click would resurrect the report just closed.

> ### ⚡ THE STANDING RULE: ONE MEASURED WALK PER RELEASE AGAINST A PRODUCTION BUILD.
>
> **`next dev` does not reproduce this class of bug at all.** The Next 16 docs say why —
> `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md:178`: *"In development,
> routes are rendered on-demand, so `useSearchParams` doesn't suspend and things may appear to work without
> `Suspense`."* Every measured walk in this project has run against `npm run dev`, which is why this survived to a
> customer. **At least one walk per release runs against `npm run build && npx next start`**, in an isolated copy if
> the owner's server is up. It costs about a minute of build time. `docs/TESTING.md` carries it; so does every
> routine's free-check list in `docs/RELEASE.md`.

---

## 5. The numbers' honest edges

Decision 10: slightly-off numbers are acceptable; nobody audits them. Honesty still — every number is a real event,
never an estimate. These are the edges, so nobody rediscovers them as bugs.

- **"Files read" counts READINGS, not documents.** A document read twice counts twice. On staging, Cascade read 12
  against 12 documents and Gamma 10 against 3. That is what the label says and what the trigger does.
- **`check:live` adds 1 to Gamma's `files_read` on staging, every run.** `scripts/check-live.js:627` seeds a real
  `document_scans` row for Test Gamma and `:725` deletes its parent document. The trigger counts the insert; the
  delete cannot un-count it, because counters never go down. **`npm run db:migrate` chains into `check:live`**, so
  every migration run drifts the number upward. Observed: 10 → 11 across step 7b. **Production is unaffected** —
  `check:live` cannot be pointed at it (`docs/HANDOFF-CODE.md:536`).
- **A checklist that failed halfway still counts.** `checklists_count_created` fires AFTER INSERT, unconditionally,
  and the row is inserted before the work is done. The number is "checklists started", under a label that says
  created. Decision 3 chose the trigger over the route precisely so no route could forget; this is its cost.
- **A counter is never decremented and has `check (>= 0)`.** Deleting a document does not reduce "Files read". That
  is migration 032's rule and 080 keeps it: these record events, never inventory.
- **The backfill set `files_read` and `audits_done` and deliberately left the other two alone.** Recomputing
  `checklists_created` from rows would have made a counter go down — Gamma held 5 against 3 rows.

---

## 6. What the next sections need to know

### My Account — the section that comes next

- **The welcome reads `profiles.full_name`.** The first word of it is the name on the Dashboard. A My Account screen
  that lets a person edit `full_name` changes what the Dashboard says, immediately — that is intended, and it is the
  only field of `profiles` a person may write besides `welcomed_at`.
- **The owner's note: the company name is tied to the company id and should not be editable on My Account.** The name
  identifies the tenant everywhere — the topbar, every audit report's header, the print frame's margin. Editing it
  from a personal account screen is the wrong door. If it is to be editable at all, it belongs on Company information,
  which already owns the company record.
- **`welcomed_at` is written by the Dashboard and refused by the database thereafter.** Nothing on My Account should
  offer to change it.
- `authenticated` still holds table-level **INSERT and DELETE** on `profiles` (migration 000). RLS denies both —
  there is no INSERT or DELETE policy — so it is closed today. It is the same "a grant list says what was added, not
  what a role holds" shape 080 closed for UPDATE. Owed; §7.

### Company information

- **Three items are parked for the final check** — see §9, copied verbatim from the plan.
- **The confirmation queue's keys are invented.** Read on production on 20 October: of 30 pending proposals, **30
  name a key that is not a switch — 19 distinct invented names, 100%.** 12 already-accepted proposals were invented
  keys too. Staging was 56 of 60. Confirming an invented key attempts to write a switch that does not exist.
- **The editor now shows the question and its help line** when a declared fact is edited, from the same column the
  Dashboard's card reads. That is the only change this section made to that page.
- The page's `plainValue` renders an enum through `allowed_value_labels` since 081 — closing the note that file had
  carried since September.

### Documents

- **The scanner invents switch keys.** `lib/documentScan.ts:1059` writes `fact_proposals` rows whose `switch_key` is
  whatever the reading called the fact. Nothing checks it against `switches`. That is the source of the queue's
  problem above, and it is Documents' to fix, not Company information's.
- Those invented key **names** reach three prompts: `lib/companyContext.ts:357` puts them in the shared brief as
  "names in circulation" (values never, only names). So a model is handed made-up fact names today.

### Whoever asks a site question first

**Three site-scope questions cannot be answered Yes or No** — the same defect 081 fixed for ten company-scope ones.
They are listed in `docs/HANDOFF-CODE.md` §7 with their wordings, and 081 §2 is the pattern: rewrite the question as
a plain yes/no and move the other half into `help_plain`, which is null for all 73 site-scope switches today.

---

## 7. What is owed, in order

1. **Nothing blocking.** The Dashboard is released and no gate is open.
2. **The three parked items** (§9) — the owner's call at the final check.
3. **The scanner's invented keys** (Documents) — the biggest of the owed, because it reaches a model and a customer's
   queue.
4. **`profiles`' table-level INSERT and DELETE for `authenticated`** — closed by RLS, open as a grant.
5. **The three forked site questions** — before any site question is asked anywhere.
6. **`check:live`'s seeded reading** drifting `files_read` on staging — cosmetic, staging only, but it means a staging
   number and a row count will never agree.
7. **The near-duplicate company names on production** — "CB-Test 1" twice, "CB-Test-1" twice, "CB-Test 2",
   "CB-Test-2" twice. A tidy-up; it makes any per-company reading hard to read.
8. **The chat switch-overs still owed from the Calendar** — HR, Audits and the Workspace onto `lib/ask/`.

---

## 8. Known defects and limits

- **A long source title still truncates a date's meta line** — it just can no longer cut the state off, because the
  state leads. Both the Calendar's list and the Dashboard's Upcoming do it.
- **No fixture company has more than six dates in the 30-day window**, so the "N more in the next 30 days." line is
  held by unit tests only and has never been photographed.
- **No company-scope `number` switch ranks into the first three questions**, so the number control (a box and Save)
  is tested and never seen on a card.
- **`/requirements` is linked from nowhere** and a GET to `/api/obligations` writes the whole obligations table on a
  first visit — 221 rows on a 16-fact fixture. Answering one question on the Dashboard does the same recompute.
- **The ask route is called twice per page load in dev**, React 19 StrictMode double-invoking the effect. Once in
  production.
- **`docs/DASHBOARD-PLAN.md` had no "parked" section** when step 10 asked for one to be copied. One was written at v3
  from the step 8 pre-check's findings; §9 is that section verbatim.

---

## 9. Parked — from `docs/DASHBOARD-PLAN.md`, verbatim

> **Parked for the final check — the owner's decision, not Claude Code's.** All three came out of the step 8
> pre-check (20 October), which asked whether anything AI-facing reads the requirements library. Nothing does; these
> are the three things that would make that rule visible in the product rather than merely true.
>
> 1. **The confirmation queue and its badge, hidden on production behind a flag** until the invented-keys fault is
>    fixed. Facts already confirmed stay visible; only the "WAITING FOR YOU" section and the sidebar count go.
>    Three files, all display: one name added to `PipelineSwitch` in `lib/pipelineConfig.ts`, the section wrapped in
>    `app/company-information/page.tsx`, and the badge's fetch skipped in `components/AppLayout.tsx:136`. No
>    migration.
> 2. **A guard on the requirements route and page.** `/requirements` is linked from nowhere, so a customer cannot
>    reach it by accident — but `GET /api/obligations` **writes** 200-odd rows on a first visit, so guarding the page
>    alone would leave a writable endpoint behind it. Four lines in each. No migration.
> 3. **The invented keys out of the shared brief.** `lib/companyContext.ts:357` puts `fact_proposals` key names into
>    every HR answer's and every document draft's context as "names in circulation". Filtering them to real switches
>    is one `.in()` clause — **and it is a prompt-input change, so `CLAUDE.md` §3.1 makes it the owner's to approve.**
>
> **Collecting stays on in every case**: the Dashboard's questions and Company information's editor both write through
> `/api/switches/answer`, which none of this touches.

---

## 10. Test data

| Who | Company | What it is for |
|---|---|---|
| `testgamma@example.com` | Test Gamma Solvents | The Dashboard's own fixture: 10–11 readings, 31 chat answers, 5 audits, 5 checklists, one date due tomorrow. **Restored to 0 switches / 0 determinations / 0 obligations and `welcomed_at` null** at the close of step 7b |
| `testcascade@example.com` | Cascade Specialty Chemicals | 12 readings, 12 documents, no audits — the day-one audits line, and the long document titles that found the meta-line defect |
| `testalpha` *(no fixture login)* | Test Alpha Chemical | 16 answered switches. Used through the service role for the obligations before/after diff; has no password, so no page can be walked as Alpha |

**On production:** 10 companies, 4 profiles, `company_switches` **completely empty** — nobody has ever answered a
switch — and `welcomed_at` null on all four profiles at the time of the release.

---

## 11. How the Dashboard chat worked, and the lessons worth carrying

- **Every step was a brief with a stop.** The two migrations were written, pasted in full, and run only after the
  owner had read them. Both self-tests refused a first run, and **in both cases the thing they caught was in the
  checking, not in the change** — an aliasing bug in 080's own test, and a rule in 081's that was too blunt and
  refused two correct wordings. A migration failing is not the same as a migration being wrong.
- **Measure before and after, with the same instrument.** Three times the measuring tool could not see the thing
  being changed, and each time it was taught to see it **before** the baseline run.
- **A check that reports an absence must be shown a presence first.** It bit twice in this section: a grep of 51
  AI-facing files returning nothing (shown to return 205 matches repo-wide), and a drawer detector that reported
  "none" before the key as well as after.
- **The brief is not always right, and saying so is cheaper than working around it.** Step 7b's check could not both
  catch all ten old wordings and pass the owner's two new ones — they are the same grammatical shape. Step 9 said the
  server on 3000 was stopped and it was not, so the build ran in an isolated copy instead. Both were reported rather
  than silently resolved.
- **The owner found the bug that mattered.** Every automated gate was green; the defect was invisible to all of them
  because they run against the dev server. §4's rule is the whole lesson of this section.

---

## 12. For the next section's chat

Start with `CLAUDE.md`, then this file, then `docs/HANDOFF-FROM-CALENDAR.md` and `docs/HANDOFF-FROM-HR.md`. The
pattern three sections have now followed: a read-only map first, boards the owner approves before any code, a plan
with numbered decisions, then steps that each end in a measured proof and a commit. Write the migration, stop, and
let the owner read it. Run the free gates every time and say which you skipped and why. And at least one walk per
release against a production build — that one is new, and §4 is why.
