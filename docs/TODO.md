# Detailed To-Do
**Version:** 6 · **Updated:** 11 September 2026
**Supersedes:** version 5 (10 Sep). Phase 1 is **complete** — migrations 006–010 on both
environments, verified identical at 673 objects. The gate drops to **one** item, key
rotation. Phase 2 is marked next with what it inherits, read from the database. A phase-number
mapping is added at the top because this file and `BUILD-PLAN.md` **swap phases 1 and 2**.
`/api/industries`, the invite feature (now M8 — Account) and the Phase 6 counts are corrected.

**Version 5** made three changes. **(1) Corrects the gate**, which claimed
the `memberships` migration was a prerequisite for user management. It is not — several
people at one company already works on `profiles.company_id`, proven on staging 10 Sep, and
what is missing is an invite flow. `memberships` moves out of the gate to Phase 11+
multi-site, where it answers its real question: one person across several companies. The
gate is now two items. **(2) Adds Phase 1.6**, the multi-facility structure — `entities`
seeded per company, `entity_id` on documents and evidence, a `scope` column on switches, and
the design rule that site is a property of data and not of people. Phase 1 goes to ~1.5
weeks. **(3) Rewrites the user-management feature** as something that needs no migration and
ships on its own timeline, with the cost of shared logins recorded.

**Version 4** restructured the phase order: the phases are now
horizontal only, and everything vertical moved into a new final `MODULES` section — seven
modules, each with the findings that were previously scattered through the document as
debts. The Compliance Workspace left Phase 3 (it was the only vertical slice among the
phases, scheduled ahead of the infrastructure it depends on); Screens left Phase 8 and was
distributed to the modules that own each screen; the audit-engine findings left §0.10; the
HR findings left Phase 6b; signup left Phase 8b. The employment law library stayed a phase,
renumbered 6c → 6b, because a library is horizontal. Version 3 added the gate at the top and
marked §0.9 complete; version 2 superseded version 1 (9 Sep). Supersedes the phase summaries
in `BUILD-PLAN.md` at task level — the build plan stays as the *why*, this is the *what next*.

**No fixed demo date.** Built properly, phase by phase, ready when it is ready.

---

> ### ⚠️ THE TWO PLANS NUMBER PHASES DIFFERENTLY. PHASES 1 AND 2 ARE SWAPPED.
>
> They agree on 0 and 4 and on nothing else. **"Start Phase 2" means opposite things in the
> two files**, so always say which document a phase number belongs to.
>
> | `TODO.md` | `BUILD-PLAN.md` | |
> |---|---|---|
> | Phase 0 — Foundation | Phase 0 — Foundation | agree |
> | **Phase 1 — Schema rebuild** ✅ | **Phase 2 — Schema extensions** | **swapped** |
> | **Phase 2 — The runtime pipeline** | **Phase 1 — Runtime fixes** | **swapped** |
> | Phase 4 — Resolution engine | Phase 4 — Resolution engine | agree |
> | Phase 5 — The worker | Phase 3 — The worker | differ |
> | Phase 6 — Library: chemical Oregon | Phase 5 — Library data | differ |
> | Phase 7 — Switches and evidence | Phase 6 — Switch determination | differ |
> | Phase 9 — Observability | Phase 8 — Observability | differ |
>
> **Neither is renumbered, deliberately.** Both documents and `DECISIONS.md` reference
> phases by number in dozens of places, and renumbering breaks every reference silently —
> the same failure `DECISIONS.md` §15.8 records for versioned filenames. The mapping is
> cheaper than the churn, but only if it is read, which is why it is at the top of both.
>
> **`TODO.md` is the one to follow for what to do next.** `BUILD-PLAN.md` is the *why* and
> the ordering; `TODO.md` is the *what next*, and it supersedes the build plan at task level.

## ⛔ GATE — THESE LAND BEFORE THE FIRST REAL CUSTOMER DOCUMENT

**One item remains.** It is cheap right now and expensive the moment a real customer's
documents are in the database — after that first upload it costs a maintenance window, a
rollback plan, and a conversation with a customer about downtime.

**1. Key rotation. Six credentials.**
Four leaked in a zip on 9 Sep. Both database passwords — production and staging — were
printed in full to a terminal on 10 Sep while fixing the migration script's error output.
The script redacts them now; the values are still out. Rotating six credentials against
test data is a chore. Rotating them while customers are working is an outage.

> ### ✅ Gate item 2 — the Phase 1 schema rebuild — CLOSED 11 September 2026
>
> Enums instead of bare text, versioning columns, `industries[]`, the switch hierarchy and
> the multi-facility structure. **Migrations 006–010, applied to both environments and
> verified identical at 673 objects with zero differences.** Everything that said "painful
> to retrofit" was done while the production tables still held only test rows we wrote
> ourselves.
>
> **Key rotation is the only thing left between here and a real customer document.**

> **Corrected 10 Sep — `memberships` was the third gate item and should not have been.**
> The claim was that `profiles.company_id` blocks user management. It does not. **Two people
> at one company already works on the current schema** — two `profiles` rows carrying the
> same `company_id` — and it was proven on staging on 10 Sep: Test Alpha Chemical had two
> users and each saw the other's checklists. Nothing structural prevents a colleague.
>
> What is missing is the **invite flow**: `/api/signup` creates a new company every time, so
> there is no path that adds a second person to an existing one. That is why every company
> has exactly one member. **A feature, not a migration.**
>
> `memberships` is needed for one thing only: **one person across several companies** — a
> consultant serving two clients, or someone spanning facilities held as separate accounts.
> Rare, and it belongs with multi-site, where it is now recorded (Phase 11+), with the
> `auth_company_id()` warning intact.
>
> The distinction matters because the two are not the same size. The invite flow is a
> feature that can ship any week. `memberships` rewrites 59 policies. Filing them together
> made the cheap one look blocked by the expensive one.

### Why this gate is written at the top

Because it is easy to state and easy to slip past. Nobody decides to skip it. What happens
is that a prospect signs, someone wants to try the product this week, one real document goes
in — and the migration does not become impossible overnight. **It becomes harder gradually,
which is exactly how work like this gets deferred permanently.** Every week after the first
upload, the argument for "we'll do it after this next thing" gets slightly better, and it
never stops getting better.

The trigger is not a date. It is **the first document belonging to someone who is not us.**

**Legend**
⚡ quality-affecting — spec before writing · 🔒 blocks later work · ⏱ effort, solo with Claude Code
✅ done · 🔄 in progress · ⬜ not started

**How this document is ordered.** Phases first — they are **horizontal**, infrastructure that
every part of the product stands on. Then `MODULES`, at the end — **vertical** slices, one
feature area at a time, built once the ground under them has stopped moving. The reasoning is
written out at the head of that section.

**There is no Phase 3 and no Phase 8.** Phase 3 was the Compliance Workspace and Phase 8 was
Screens; both were vertical and both moved into `MODULES`. The remaining phases are **not**
renumbered: this document and its companions reference phases by number in dozens of places
(`7.3`, `2.6`, `5.2`, `6.7`), and renumbering breaks every one of them silently. Two gaps in a
sequence is the cheaper cost.

---

## PHASE 0 — Foundation

Making the ground solid. Nothing here changes what a customer sees.

### 0.1 Environment and tooling ✅ DONE (9 Sep)
- ✅ `CLAUDE.md` in place, `@AGENTS.md` preserved
- ✅ `scripts/db-migrate.js` and `db-types.js`, project ref from env
- ✅ `package.json`: `typecheck`, `db:migrate`, `db:types`, `check`, `db:migrate:prod`
- ✅ Staging Supabase project created, West US
- ✅ Type generation working, `lib/database.types.ts` real
- ✅ Production migration gated behind a typed `PRODUCTION` confirmation
- ✅ `docs/` folder, five documents committed

### 0.2 Schema reproducibility ✅ DONE (9 Sep)
- ✅ `CURRENT-SCHEMA.md` — full production schema documented
- ✅ `000_baseline.sql` — 19 tables, 780 lines, reconstructed from catalogs
- ✅ Staging built from files alone, verified structurally identical to production
- ✅ Migration history recorded on both projects
- ✅ `baseline-outputs/` — 947 rows of AI output preserved before prompt changes

### 0.2b Local development points at staging ✅ DONE (10 Sep)
- ✅ `.env.local` app keys switched to staging; production keys removed from the laptop
- ✅ 188 `requirement_templates` loaded into staging (unblocks signup, profile save, obligation matching)
- ✅ Verified: My Account shows *Test Alpha Chemical*
- ⬜ Load `standard_templates` (1 row) so audits reuse the cache instead of regenerating

**Why:** the dev server ran for six hours pointed at production while hot-reloading a new, untested DELETE route. Local dev must never be one click from destroying production data.

### 0.3 Storage security ✅ DONE (9 Sep)
- ✅ Found: all three storage policies checked only `bucket_id` — any logged-in user could read and delete every file
- ✅ `002_storage_company_scoping.sql` — four policies, company-prefix scoped
- ✅ Tested on staging with two real users, six tests, all passed
- ✅ Impact traced module by module before applying — nothing broke
- ✅ Applied to production

### 0.4 🔒 Close the remaining service-role holes ✅ DONE (9 Sep)
The storage policies did not protect these — the service-role key bypasses RLS entirely. *(That was the state on 9 Sep. §0.9 has since converted the routes to run as the caller, so the policies now apply.)*

**Full route map completed 9 Sep.** 21 routes: 17 service-role, 2 session-verified, 9 taking identity from a client parameter. Every one is now closed, deleted, or confirmed safe.

**Fixed — identity now derived from the verified session via `requireCompany()`:**

- ✅ **`/api/documents`** — all four methods, ownership checks, destination checks. **Now the reference implementation** (`CLAUDE.md` §3.6).
- ✅ **`/api/account`** — the worst of them. DELETE took `user_id` from the URL with **no authentication of any kind** and destroyed the whole company: rows across 15 tables, the company record and the login. One request, one guessed id. Now session-derived, gated on typing the company name, and it deletes the storage files too (previously orphaned forever). Tested 5/5 on staging including the real irreversible delete.
- ✅ **`/api/account/export`** — new. Every row the company owns, one JSON file. Tenant-scoped both directions, verified by searching each export for the other company's ids and name.
- ✅ **`/api/hr`** — accepts document ids, not `file_url`; rejects the whole request if any id fails ownership. Was the last way to read another company's files after migration 002, because the service role bypasses the storage policies.
- ✅ **`/api/audits`** — `company_id` from a query parameter and an unscoped DELETE; re-running someone else's audit would have rebuilt it against this company's documents.
- ✅ **`/api/hr-audits`** — `companyId`/`userId` from the body, and `handbookFileUrl` too, so a saved record could point at another company's file.
- ✅ **Unscoped-delete family** — `/api/folders`, `/api/calendar`, `/api/document-review`. All were `DELETE ?id=<uuid>` → `.delete().eq('id', id)` with no company predicate. Folders also gained a parent-ownership check and company-scoped "folder not empty" counts.
- ✅ **`/api/substeps`, `/api/link-research`** — wrote to checklists keyed on a body id. Linking checks **both** ends; checking only the row being updated still allows a link into another company's checklist.
- ✅ **`/api/obligations`** — returned any company's full compliance position, the most sensitive list in the product, to anyone who knew the id.

**Confirmed safe, left as they are:** `/api/signup` (no session exists yet), `/api/industries` (shared library data, no tenant rows), `/api/chat`, `/api/extract-dates`, `/api/scan-website`, `/api/feedback` (no database, no service role).

**Deleted rather than fixed** — all three orphaned with zero callers:
`/api/folders/industry`, `/api/requirements`, `/api/sync-obligations`.
Confirmed before deleting: no `vercel.json`, no cron schedule anywhere in the repo, **no cron jobs configured in Vercel at all**, the marketing site is not in this repo, and no script or document holds a hardcoded URL. Hardening three routes nobody calls is worse than deleting them.
`CLAUDE.md` §3.6 previously named `/api/folders/industry` as the reference to copy — it now names `/api/documents`.

**Two prompt-injection paths closed along the way.** `company_name` and `industry` were arriving from the request body and going straight into prompts (`/api/hr`, `/api/audits`, `/api/document-review`). All three now read them from the company record. Caller-supplied free text landing inside a prompt is a way to lean on the model's instructions, not just a label.

**One real bug found while closing `/api/hr`:** any non-PDF was base64-encoded and labelled `image/jpeg`. A `.docx` handbook — the format handbooks usually arrive in — was passed to the model as an unreadable picture, and the model answered anyway. Confident output from nothing. Now only PDFs and real image types are sent; anything else is named to the user with the reason.

**Testing.** Every fix was exercised against staging with two real companies and real session tokens, not asserted from reading the code. For each route: no login → 401; own rows → own rows only; another company's id → 404 (never 403, so ids cannot be probed); delete of another company's row → 404 and the row verified intact by service role; write naming another company → landed in the caller's own company.

**Acceptance met:** no route derives tenant identity from a client parameter. Every service-role use is either a route with a verified session or a place where no session exists.

### 0.5 Tenancy consistency ✅ DONE (10 Sep) — migration 003, **applied to production**
Every data table now scopes by `company_id`, in the column and in the policy. Applied to
staging, tested with three logins across two companies, then applied to production and
verified there: 235 checklist items backfilled with zero nulls, twelve company-scoped
policies and none user-scoped, `folder_audits` gone (18 tables now, was 19), row counts
unchanged at 11 / 235 / 47, and history recording 000–003. Types regenerated from
production are byte-identical to the staging-generated file, which is the check that the
two databases have not drifted.

- ✅ `calendar_events` — route fixed 9 Sep; **RLS policies replaced 10 Sep**. All four verbs, company-scoped, explicit `WITH CHECK`. No runtime change: nothing reads this table from the browser, so this aligns the database with what the route already enforced and is what lets the route stop using the service-role key.
- ✅ `checklists` — company-scoped. Gained an **UPDATE policy**, which it never had; that absence is why linking a research answer to a checklist had to go through a service-role route.
- ✅ `checklist_items` — **gained a real `company_id` column**, backfilled from the parent (235 rows, 0 orphans) and set `NOT NULL` with an FK and index. Policies now scope on its own column instead of subquerying `checklists`. One less table whose RLS has to hold for this table's RLS to work — the same coupling that makes the storage policies fragile.
- ✅ `folder_audits` — **deleted**, see below.
- ⬜ `documents.company_id` is still nullable. Every ownership check written in 0.4 fails closed on a null, which is the safe direction, but the column should not permit it. Left for the Phase 1 schema rebuild rather than patched here.

**Colleagues now see each other's checklists.** That is the intent and it matches documents and the calendar — the compliance record is a company asset. It is a visible product change, not just an internal one.

**One hazard fixed in the same change, not after.** `deleteChecklist` in `app/compliance/page.tsx` deleted with `.eq('id', id)` and no ownership filter; `toggleCheck` updated a checklist item the same way. Both were safe *only* because RLS narrowed them to the caller's own rows. Widening the policies to company scope without adding an explicit company filter would have turned "delete my checklist" into "delete any colleague's checklist", reachable from the existing UI. Both now carry `.eq('company_id', companyId)`.

**folder_audits is retired, not deferred.** It inferred compliance from folder *names* — a folder called "DOT" with any file in it read as green. A filename is not evidence, and an expired permit filed in a correctly-named folder scored identically to a current one. That is the false-green failure the product exists to prevent, so it is deleted rather than re-scoped: table, three policies, three foreign keys, generated types, its entry in the account-delete list, and its references here. There was no page, component or nav entry. One production row destroyed — a scan result derived from folder names, not a customer document.

**`/api/cron/monthly-summary` deleted with it.** A third of the email was built on folder audits, and §0.8 established the route had never run — no `vercel.json`, no cron jobs configured in Vercel at all. Dead code calling dead code. `CRON_SECRET` is removed from `.env.example` too. A monthly summary is still wanted, but it should be written against obligations and evidence — what the company must do and what proves it — not against folder names. That belongs after Phase 4, when obligations are real.

### 0.6 Write policies on every table ✅ DONE (10 Sep) — migration 004, **applied to production**

Every table now has a full set of access rules, and the tenancy rule lives in one named
place instead of being re-derived in twenty of them.

- ✅ **`auth_company_id()`** — `SECURITY DEFINER`, `search_path` pinned, returns the
  caller's `company_id` from `profiles` with definer rights. Every company-scoped policy
  goes through it. **53 of 58 policies** use it; **0 reference `profiles` directly**, down
  from 19.
- ✅ **The five zero-policy tables** — `audits`, `company_templates`, `document_reviews`,
  `hr_audits` got the full four. `standard_templates` joined the reference tables
  (readable by any authenticated user, service-role writes only); it was the only one of
  the three missing its read policy, which is why checking the shared cache forced
  `/api/audits` onto the service-role key.
- ✅ **`documents`** — moved from `auth.uid() = user_id` to company scope, matching what
  its route has done since 9 Sep, and gained the UPDATE policy it never had. 38 rows,
  0 with a null company, nothing became invisible.
- ✅ **`obligations`, `obligation_evidence`, `entities`, `corrections`** — were SELECT
  only, now full. `obligations` has **no DELETE policy on purpose** (§3.2: obligations are
  never deleted, only marked).
- ✅ **`obligation_evidence` gained its own `company_id`** — backfilled, `NOT NULL`, FK,
  index. Without it, scoping meant another subquery into another protected table, which
  is the coupling this migration removes.
- ✅ **`companies` INSERT and `profiles` INSERT removed** — neither had a legitimate
  caller. Both happen in signup under the service role. Allowing a session to do either
  let anyone manufacture a company, or attach themselves to one by writing their own
  profile row.
- ✅ **`anon` revoked on all 18 tables** — 144 privileges to 0. It was denied by policy
  anyway, but one forgotten policy on a new table and it would have had everything. Now
  it is refused at the grant, before policies are consulted.

**Verified on production:** 58 policies / 0 via profiles / 53 via the function, no table
with RLS on and zero policies, anon privileges 0, every row count identical across all 18
tables, types byte-identical to the staging-generated file.

**Tested on staging with real logins at the browser's own surface** (anon key + user JWT,
not through the app): 12 tables show only the caller's rows, cross-company writes refused,
moving a row into another company refused by `WITH CHECK`, reference tables read but not
write, creating a company refused, and an unauthenticated caller refused outright.

**Not done here, deliberately: no route was converted off the service-role key.** Rules
first, proven; routes after. See 0.9.

### 0.9 Convert routes off the service-role key ✅ DONE (10 Sep)

Migrations 002–005 made the database able to enforce tenancy on its own. This made it do
so: routes now connect as the person making the request, so the policies apply instead of
being bypassed. Both layers are load-bearing — application code derives identity from the
session, and the database enforces it independently. A route that forgets a check now fails
closed rather than leaking.

**Final census — 18 routes.**

**On the caller's token (10):** `account/export`, `calendar`, `document-review`,
`documents`, `folders`, `hr`, `hr-audits`, `link-research`, `obligations`, `substeps`.

**Holding the admin client (4), each for a reason written into the file:**

| Route | Why it keeps the key |
|---|---|
| `account` | DELETE calls `auth.admin.deleteUser()`. Removing a login is an admin API, not a table write — no user token performs it at any privilege. GET and PUT are converted; the file holds both clients and says which is used where. |
| `audits` | One statement: the shared parsed-standard cache insert on a cache miss. That table is reference data with no tenant column and no write policy, deliberately — an INSERT policy would let any authenticated user write into a cache every other company reads. The read beside it *is* converted. |
| `industries` | Serves the signup page, which is public and has no session by definition. The requirements library is readable `to authenticated`, and 004 revoked anon's grants, so under a caller's token it returns nothing and the dropdown empties — which blocks signup. |
| `signup` | Creates the auth user, company and profile before any session exists. |

**No database at all (4):** `chat`, `extract-dates`, `scan-website`, `feedback`.

**`reviewDocument`'s fallback is gone.** That shared module used to build its own admin
client and fall back to it when a caller passed none. Both callers now pass one, so the
fallback was unreachable code that silently bypassed RLS — the kind that gets picked up
later by someone who does not know why it was there. The `db` parameter is **required**
now, so the compiler enforces it and a future caller cannot forget.

**The rule this established:** a route may keep the admin client for a *named statement*
with a comment explaining it. It may not keep it out of habit. Every one of the four above
names its statement.

**Verification standard used throughout** — see `DECISIONS.md` §17.6. Not HTTP status:
RLS is a filter, not a gate, so a read that is too narrow returns `[]` with a perfectly
good 200. Every conversion was checked by comparing per-table row counts, and usually exact
id sets, under the caller's token against the same query run with the service role, with
joined tables checked separately because a blocked join returns the right number of rows
with empty content.

### 0.8 Follow-ups from the Phase 1 rebuild ⬜

- ✅ **`/api/industries` was broken in production by migration 007, and nothing noticed.**
  007 replaced `industry text` with `industries text[]`; this route — **named as the only
  caller in 007's own header** — kept selecting the old column. PostgREST returned
  `42703: column requirement_templates.industry does not exist`, the catch turned it into
  a 500, and the signup dropdown came back empty. **An empty dropdown blocks signup**, on
  the one page with no session and no other way in. Fixed 11 Sep.

  **`npm run check` passed throughout.** A column name inside `.select()` is a string and
  the generated types cannot see into it — which is exactly what makes them valuable
  everywhere else. A column rename is therefore two changes: the migration, and a sweep of
  every query string naming that column.

  A sweep of all 57 source files against the live schema found this and nothing else. Two
  call sites use a **variable** table name (`/api/account/export`'s `byCompany()` and
  `/api/account` DELETE's table list) which neither the sweep nor the compiler can check;
  all 23 tables they name were verified by hand to carry `company_id`.

- ⬜ **The loader should reach production without a service-role key in `.env.local`.**
  `scripts/load-requirements.js` writes through PostgREST, so `--production` needs
  `SUPABASE_PROD_URL` and `SUPABASE_PROD_SERVICE_ROLE_KEY` — and `CLAUDE.md` §3.8 says
  both are expected to be **blank**, because a laptop points at staging and a live key
  sitting in a file on a machine that also runs `npm run dev` is how an ordinary local
  click reaches production. So loading production today means setting two secrets and
  remembering to clear them, and "remembering" is the weak part.

  `scripts/db-migrate.js` already has the answer: it reaches production through the
  **session pooler** using `SUPABASE_PROD_DB_PASSWORD`, which is a credential that has to
  be present locally anyway to ship a migration at all. The loader should do the same.
  Neither `psql` nor the `pg` package is installed, so this needs one of them added — a
  real change, deliberately **not** made in the middle of a production run.

  Until then the loader fails loudly when the variables are missing, names both, says
  they are meant to be blank, and prints a clear-them reminder on success. That is a
  guard against forgetting, not a substitute for the fix.

- ⬜ **The requirements screen is empty until Phase 4, and that is expected.**
  Migration 007 drops `obligations` — 376 rows in production, all of it derived output
  (188 templates × 2 companies) and all of it carrying the jurisdiction bug: matching was
  on an unverified AI scan blob rather than the customer's stated address, so most
  companies silently received federal rows only (1.4). Nothing
  regenerates those rows until the resolution engine exists in **Phase 4.1**.

  So after 007 lands, `/requirements` shows nothing and `/api/obligations` returns an
  empty list with a 200. **That is the schema being correct and the engine not being
  built yet — not a regression.** It belongs in `STATUS.md` the moment 1.5 writes it,
  as: *Requirements — not-yet-rebuilt, awaiting Phase 4.1.* Without that line, the first
  person to open the page after the rebuild reports a bug that isn't one.

---

### 0.7 Housekeeping ⬜ ⏱ 2 hours
- ⬜ Delete four orphaned storage files under a prefix matching no company
- ⬜ Remove unused deps: `ai`, `@ai-sdk/anthropic`
- ✅ `updated_at` trigger — **written in migration 006**, not yet applied. Five tables
  carry the column (`agencies`, `entities`, `obligations`, `requirement_templates`,
  `standard_templates`), not nine — `CURRENT-SCHEMA.md` says nine and is wrong
- ⬜ **`/api/folders` POST drops `section`.** `app/documents/page.tsx:307` sends it and
  the route never destructures it (`app/api/folders/route.ts:41`), so every folder made
  through the UI silently takes the column default `files`. The 20 `hr` and 12 `log`
  rows in production came from somewhere else. Same class as the HR upload bug below —
  a field the caller set, discarded with no error
- ⬜ **`/api/documents` POST drops `category`.** `app/hr/page.tsx:126` sends
  `category: 'hr-handbooks'`; `documents` has no such column and the route does not
  destructure it. HR handbook uploads land with no marker of what they are, which is
  part of why 13 of 38 documents have a null `folder_id`
- ⬜ Resolve pricing: $199 or $99
- ⬜ Remove HIPAA as a surfaced audit example
- ⬜ Fix `app/upload/page.tsx:89` — `getPublicUrl` on a private bucket, already broken
- ⬜ Add to docs: baseline exports go in git **only** while data is synthetic
- ⬜ **`supabase db query -o json` returns two different JSON shapes.** Which one depends
  on the CLI's agent detection (`--agent auto|yes|no`): a bare array `[{...}]` when it
  thinks a person is calling, a wrapped object `{"boundary":…,"rows":[…],"warning":…}`
  when it thinks a program is. Anything parsing that output must handle both, and must
  treat an unrecognised payload as a failure rather than as an empty result. This cost
  two aborted production migrations on 10 Sep: the parser read only the wrapped form, so
  in a human terminal it read a full history as empty and reported every migration as
  pending — silently, because nothing threw. Fixed in `scripts/db-migrate.js`; that is
  currently the only place in the repo that parses CLI JSON, and any new one has the same
  trap waiting.

- ⬜ **Deleting a route breaks `npm run check` until `.next/types` is cleared.** Next.js
  generates a route validator under `.next/types/` referencing every route file. Delete a
  route and the stale validator remains, so `tsc --noEmit` — which runs *before* `next
  build` in `npm run check` — fails with `TS2307: Cannot find module
  '../../app/api/<name>/route.js'`. Hit this deleting the three orphans on 9 Sep. Fix is
  `rm -rf .next/types`; the build regenerates it. Worth a line in the check script or a
  `predev`/`prebuild` clean so the next person does not lose ten minutes to it.

---

## PHASE 1 — Schema rebuild ✅ **COMPLETE 11 September 2026** ⏱ ~1.5 weeks

Production data is test data. Rebuild the schema correctly rather than patching it. Everything drops and reloads.

**This is gate item 2.** Every column below is cheap to add to empty tables and expensive to
add to a customer's. 1.6 is the clearest case in the phase and the most recent addition.

### Phase 1 is complete — 11 September 2026

All six items. **Migrations 006–010 are applied to BOTH staging and production**, as of
11 September.

**The two environments are verified identical: 673 objects each, 0 differences** — columns,
indexes, policies, constraints, enum values, functions, triggers, grants and storage
policies, compared in both directions.

*This paragraph twice said production was further ahead than it was, both times written from
recollection and both times caught by a pre-flight or a comparison. It is now read from the
database.*

**Gate item 2 is closed.** Only key rotation remains before the first real customer document.

**✅ Done, in production:** 1.1, and the library reloaded onto it.

- **Migration 006** — twelve enum types; six columns converted; `employee_count` from text
  bands to `integer` (all 10 companies became NULL, intended — §21.1); the `updated_at`
  trigger on five tables. Applied to production 11 Sep.
- **Migration 007** — the Requirements spine rebuilt: `agencies`, `requirement_templates`,
  `entities`, `obligations`, `obligation_evidence` dropped and recreated with the full
  column set. Applied to production 11 Sep.
- **The library loaded** — 194 rows, 192 active, 2 retired parents, 6 children with
  resolved lineage, 188 original ids preserved. The re-categorisation and splitting pass
  (§21.4) is complete and in production.
- Production and staging verified **identical across 480 schema objects**.

**⬜ What remains in Phase 1:**

| | | |
|---|---|---|
| **1.2** | The six new tables | ✅ **Five DONE 11 Sep** (migration 008, staging only): `switches`, `company_switches`, `industry_coverage`, `library_candidates`, `jobs`. `topics` deliberately deferred — see M1 |
| **1.3** | Rebuild staging from zero | ✅ **DONE 11 Sep.** `npm run db:reset` exists, and running it found two defects — see below |
| **1.4** | Make the match key's inputs correct and complete | Renamed 11 Sep. Sites can now state their jurisdiction (009) and the rule is written down; the **implementation moved to Phase 4.1**, where the engine that uses it lives |
| **1.5** | `STATUS.md` | ✅ **DONE 11 Sep** — at the repo root. One line per module with the date it was last actually checked, and `unknown` used where it is the true answer |
| **1.6** | Multi-facility wiring | ✅ **DONE 11 Sep** across 007–010. `entity_id` on all five tables; `switches.scope` with its composite FK and check (008); jurisdiction columns on `entities` (009); **every company now gets a primary site in the same statement that creates it**, and the 10 existing companies were backfilled (010) |

### ✅ 1.3 — the chain now builds a database from nothing, and it did not before

`npm run db:reset` drops every object in `public` (and the policies the chain owns on
`storage.objects`), clears the migration history, and runs 000→007 against the empty
result. It refuses `--production` outright, by flag and independently by ref, and requires
typing `RESET`.

**Running it for the first time broke twice, which is the entire value of having run it.**

**1. `001_step3_spine.sql` collided with `000_baseline.sql`.**
`ERROR: relation "requirement_templates" already exists`. 000 was reconstructed from
production's catalogs on 9 Sep, at which point 001 had long been applied — so everything
001 creates is already inside 000. Verified against a database with only 000 applied: 6 of
6 tables, 8 of 8 indexes, 6 of 6 RLS, 6 of 6 policies. 001 is now a **no-op that explains
itself**, kept rather than deleted so the numbering and the two databases' histories stay
honest.

**2. `000_baseline.sql` collided with its own previous run.**
`ERROR: policy "Users can delete own files" for table "objects" already exists`. 000
recreates three storage policies so that 002 has something to drop — but they live on
`storage.objects`, not in `public`, and the bucket-only ones reference nothing in `public`,
so not even `CASCADE` reaches them. 000 now drops-if-exists first, the way 002 always did,
and the reset clears storage policies too.

**Neither was reachable incrementally.** 001 was marked applied by hand before 000 existed,
so it had never been executed again; the storage collision needs 000 to run twice. Both
would have surfaced the first time anyone built a database from scratch — a new
environment, a disaster recovery, a second staging project — and would have looked like a
mystery rather than a known quantity.

**The proof, which is the point:** production (grown incrementally, migration by migration
since June) and staging (built from nothing by 000→007 on 11 Sep) compared across columns,
indexes, policies, constraints, enum values, functions, triggers, grants and storage
policies — **484 objects each, 0 differences.**

**The rule this earns:** *a chain that has only ever been applied incrementally is not known
to work. It is known to have worked once, in one order, from one starting state.* Run
`npm run db:reset` after adding a migration, not before shipping one.

### 1.1 🔒 Design the corrected schema ⚡ ⏱ 2 days
- ⬜ Postgres `ENUM` for every enum-like column, replacing bare `text`
- ⬜ `industries text[]` on requirements — one row, many verticals
- ⬜ Switch hierarchy: `depends_on_switch` / `depends_on_value`
- ⬜ Fifth state `not_applicable`, distinct from `unknown`
- ⬜ Jurisdiction columns: level, state, county, city
- ⬜ Versioning: `version`, `effective_from`, `effective_to`, `supersedes_id`
- ⬜ `scope_rules` — what a requirement does NOT cover, and its common misreading
- ⬜ `applies_expression jsonb`
- ⬜ Verification: `verification_status`, `verified_by`, `verified_at`, `citation_url`, `citation_quote`, `source_checked_at`
- ⬜ New cadence values: `continuous`, `pre_approval`
- ⬜ `entity_scope` gains `product`

### 1.2 New tables ⬜ ⏱ 2 days
- ⬜ `switches` — definitions with hierarchy
- ⬜ `company_switches` — value, `basis`, confidence, source, `user_locked`, `expires_at`
- ⬜ `industry_coverage` — industry × jurisdiction × agency → status
- ⬜ `library_candidates` — requirements produced without a library
- ⬜ `jobs` — the worker queue
- ⬜ `topics` — conversation topics, open/closed, with summaries

### 1.3 Rebuild ⬜ ⏱ 1 day
- ⬜ Write migrations, apply to staging, verify from scratch
- ⬜ Rebuild staging from zero — proves the migrations are complete
- ✅ Rebuilt production, reloaded the library (**194 rows, 192 active**), recreated test accounts

### 1.4 🔒 Make the match key's inputs correct and complete ⬜ ⏱ half day
*Renamed 11 Sep. The implementation moved to Phase 4.1 — see below.*

**94 of 192 active requirement rows are Oregon-specific** (91 at `layer = state`, plus the
3 fire-code rows at `layer = local`). Getting the match key wrong therefore decides roughly
half of what a customer is told.

**⚠️ THE DESCRIPTION ABOVE WAS WRONG IN FOUR DOCUMENTS. Corrected 11 Sep.**

The deleted route did **not** match on industry alone. It filtered on jurisdiction:

```js
templateQuery = state
  ? templateQuery.or(`jurisdiction_state.is.null,jurisdiction_state.eq.${state}`)
  : templateQuery.is('jurisdiction_state', null)
```

**The real defect is that `state` came from `scan_result->>'state'` — an unverified AI
website-scan blob — and not from `companies.state`, the address the customer gave us.**

Three consequences, and the direction is the opposite of what was recorded:

1. **`scan_result` is null for 7 of 10 production companies.** For those the filter falls
   to `jurisdiction_state is null`: **federal rows only, all 94 Oregon rows silently
   dropped.** The live failure is UNDER-serving, not over-serving. Per `CLAUDE.md` §3.2
   that is the safer direction, and it is still wrong — a company is told less than it
   owes and has no way to know.
2. **The two sources already disagree on a live row.** `CB-Test 2` is `Oregon` by address
   and `Washington` by scan. It would have been matched against Washington, of which the
   library holds zero rows, and received only the 95 federal ones.
3. **County, city and local were never considered at all** — only `jurisdiction_state`.

Over-serving is *possible* through the same hole (a scan claiming Oregon for a Texas
company) but no production row does it. The honest statement is: **the match key used a
derived, unverified jurisdiction in place of a stated one, and ignored three of the five
layers.** `${state}` was also interpolated straight into a PostgREST `.or()` string, so a
comma in the value would have broken the filter.

**Why it matters that the record was wrong:** it would have sent someone hunting for a
missing `.eq()` that was never missing, and left the actual cause — an AI artifact
silently outranking the customer's own address — in place. `DECISIONS.md` §24.1 settles
the source of truth.

### Why the implementation is Phase 4.1 and not Phase 1

Phase 4.1 is defined as *"Jurisdiction + switches + library version → obligations.
Deterministic."* **The match key is three-quarters of that sentence.** Writing it now means
writing it against a resolution engine that does not exist, then writing it again — and
4.4 makes *"state X never receives state-Y requirements"* a required test of that engine,
not of a route.

It belongs in `lib/resolution.ts` as a **pure predicate** — facts and rows in, rows out —
never as a SQL filter. Three reasons: §3.2 requires resolution to be deterministic and
computed in code; a predicate is testable without a database and a PostgREST `.or()` string
is not; and the failure mode of a too-narrow SQL filter is **fewer rows with a perfectly
good 200**, which is exactly what the deleted route did for months with nobody noticing.
Load candidates with a deliberately broad query and narrow in tested code, so that if the
SQL is ever wrong it is wrong in the superset direction where the code catches it.

### What Phase 1 lands instead — the inputs, not the rule

- ✅ **Jurisdiction columns on `entities`** (migration 009). A site had no way to say where
  it was, which made `local` and `city` requirements **unresolvable for every company**.
  The three Oregon Fire Code rows are the first that need it.
- ✅ **The authoritative-source decision** — `companies.state/county/city`, never
  `scan_result` (`DECISIONS.md` §24.1).
- ✅ **The full six-case match rule written into `CHEMICAL-OR-WA.md` §3.2**, including the
  two cases that had no rule at all, so Phase 4 inherits it rather than reinventing it.
- ⬜ **Address capture is still incomplete.** Signup hardcodes `county: ''` and never asks,
  yet `jurisdiction_layer = 'county'` is a value the match key must serve. Belongs with
  M7's signup rework, and until then no county-scoped requirement can resolve.

### 1.5 `STATUS.md` ⬜ ⏱ 1 hour
One line per module: working / broken / not-yet-rebuilt / verified-on-date. Prevents "broken and nobody noticed" during a rebuild.
**First line to write, already earned:** *Requirements — not-yet-rebuilt, awaiting Phase 4.1.*
Migration 007 dropped the 376 obligations and nothing regenerates them until resolution
exists, so the screen is empty by design. See §0.8.

### 1.6 🔒 Multi-facility structure ⚡ ⏱ 1 day
*Designed with 1.1, applied in 1.3. Numbered last because it was added last, not done last.*
**Design:** `CHEMICAL-OR-WA.md` §6.6. **Decision:** `DECISIONS.md` §20.

**One company with facilities in different places is normal in chemical manufacturing, and
their requirement lists genuinely differ by site** — different OSHA citations, different
waste rules, a different air authority. The six-facility cannabis prospect is not six legally
separate entities; it is one business with six sites. Treating "the company" as the only unit
of compliance is wrong for both.

**The near-term workaround stands: one account per facility** (`DECISIONS.md` §17.4). It
works today and it is the right call for release one. It also costs, and the cost is worth
writing down rather than discovering:

- Company-level documents — the corporate ISO certificate, the written HazCom program — get
  uploaded once per account, and each copy ages independently.
- There is no roll-up. Nobody can ask *"where are we exposed across all six?"*
- Consolidating later means **merging several live customer accounts** and deciding which
  copy of a shared document is authoritative. That is a data migration on real records with
  a customer waiting.

**So build the structure now and the interface later.** The structure is a day; retrofitting
it after customer data exists is two to three weeks, because it reaches resolution, switches,
evidence, documents and every screen at once.

- ⬜ **`entities` populated with one site per company at signup, always** — including for
  single-site customers. A default row means nothing is ever special-cased later: no
  `if (company has one site)` branch, no nullable-everywhere, and adding a second site is an
  insert rather than a migration. The table already exists with `entity_type` and
  `parent_entity_id`; it holds zero rows today.
- ⬜ **`entity_id` on `documents`, `obligations` and `obligation_evidence`.** `obligations`
  already has it (FK to `entities`, `ON DELETE CASCADE`); the other two do not.
- ⬜ **A `scope` column on `switches` — `company` or `site` — with a nullable `entity_id` on
  `company_switches`.** Employee count and ISO certification are company-wide. Generator
  category, air permit tier and underground storage tanks are per-site, and a company-wide
  answer to those is simply wrong at five of six facilities.
- ⬜ **Sites carry the nickname the operator actually uses** — `CompanyA-Hillsboro`, not
  `Site 2` or a generated label. A plant manager thinks *"the Hillsboro plant"*; if the
  product makes them translate that into an id, the product is harder to use than the
  spreadsheet it replaces.

**⚡ The design decision to record, because it is the one that could go wrong: site is a
property of DATA, not of PEOPLE.** A permit belongs to a site. A user belongs to the
*company* and sees everything in it. *"Which site am I looking at"* is a **filter** — a
dropdown, with roll-up as "all sites" — and never a permission.

The tempting alternative is per-user site access, and it is a trap. It makes the simple case
(one site, one person) complicated, it turns a dropdown into a permissions system with an
inheritance model and an admin screen, and every query then has to ask *"which sites may this
person see"* before it can ask anything useful. If a customer later asks that the Hillsboro
manager not see Seattle's findings, **that is a separate permissions feature**, priced and
built as one — not something to pre-build for a customer who has not asked.

**Not in this phase:** the site selector, the roll-up dashboard, per-site onboarding. Those
are interface, they live in `MODULES`, and they get built when a customer asks for them.

---

## PHASE 2 — The runtime pipeline ⬅️ **NEXT**

### What Phase 2 inherits — 11 September 2026

*Read from the database, not recalled.*

- **Two identical environments.** Staging and production both on migrations 000–010,
  verified object for object: **673 objects each, 0 differences in either direction.**
- **A migration chain proven from nothing.** `npm run db:reset` rebuilds staging empty and
  runs 000→010. Run it after adding a migration, not before shipping one.
- **A categorised library.** 194 rows, 192 active, 2 retired parents, 6 split children.
  Every row has one of ten obligation types and a jurisdiction layer. **94 of 192 are
  Oregon-specific**, which is why the match key decides roughly half of what a customer is
  told.
- **22 enum types**, 65 policies (59 through `auth_company_id()`), `anon` holding nothing.
- **Five tables ahead of their callers** — `switches`, `company_switches`,
  `industry_coverage`, `library_candidates`, `jobs` — all empty, all with no reader yet.
- **Every company has exactly one primary site**, and a trigger keeps that true for the
  next one.
- **The six-case match rule written down** (`CHEMICAL-OR-WA.md` §3.2) and **not
  implemented** — that is Phase 4.1, not this phase.
- **`npm run check` guards the query strings the compiler cannot see**
  (`scripts/check-schema-contracts.js`), written after a column rename broke signup in
  production with a green build.

**What Phase 2 does NOT inherit:** any obligations. The table is empty in both environments
and stays empty until the resolution engine exists in Phase 4.1. The requirements screen is
blank by design — `STATUS.md` says so, and it is not a regression.



Where answer quality actually changes. Everything here is ⚡.

### 2.1 🔒 Agency list ⬜ ⏱ 1 afternoon
Moves cannabis from *enumerate from nothing* to *bounded agency scope*. **Highest value per hour in the entire plan.**

- ⬜ Chemical Oregon: Oregon OSHA, DEQ, OSFM, local fire, local sewer, SoS, DOR, BOLI, ODOT, ODA + federal OSHA-baseline, EPA, DOT/PHMSA, FMCSA
- ⬜ Cannabis Oregon: OLCC, Oregon OSHA, ODA, DOR, Water Resources, DEQ, local fire, local jurisdiction
- ⬜ Tag by industry via `industries[]`

### 2.2 Determination gate — Stage 1 ⚡ ⏱ 2 days
- ⬜ Classify: what facts decide this, which are known, which are blocking
- ⬜ **Output schema must include an "ask" path** — its absence is the root cause of the 2.5L failure
- ⬜ At most one blocking question, always paired with what it unlocks
- ⬜ Stricter threshold for checklists (§4.3 of the workspace design)

**Acceptance:** the 2.5L bottle question requests the SDS instead of enumerating past the missing packing group.

### 2.3 Critic pass — Stage 5 ⚡ ⏱ 3 days
Fresh call, sees only the output, adversarial framing.

- ⬜ Physical object · regime · scope exclusions · assumed determinations · every date/fee/threshold · agency coverage · unstated assumptions
- ⬜ Must see what the answer is *built on*, not just the latest turn
- ⬜ Strongest model
- ⬜ Material error → one loop back to identification

**Acceptance:** catches the combination-packaging error in the saved 2.5L output.

### 2.4 Split identification from expansion ⚡ ⏱ 1 day
- ⬜ Identification at `temperature: 0.1`, stating physical object and regime per requirement
- ⬜ Only survivors get sub-steps and costs
- ⬜ Sub-steps go to determination and decision first, procurement second

### 2.5 `lib/ai.ts` improvements ⚡ ⏱ 1 day
- ⬜ Task-based model routing — strongest for critic, cheap for expansion
- ⬜ Record token usage per call
- ⬜ Temperature audit across every call site
- ⬜ Migrate `scan-website` back through `askAI()` (web search is now supported)

### 2.6 Zod at the AI boundary ⬜ ⏱ 2 days
`askAIJson` returns `any` after a `JSON.parse`. A malformed extraction surfaces as a Postgres error rather than a per-field diagnosis.

**Found 9 Sep, live on staging — an empty model response becomes a raw 500.**
`JSON.parse` at `lib/ai.ts:107` runs unconditionally on whatever came back. The
truncation guard above it (line 63) only fires on `stop_reason === 'max_tokens'`, so a
response that is empty for any other reason is never caught: `JSON.parse('')` throws
`SyntaxError: Unexpected end of JSON input`, which propagates out of the route and
reaches the caller verbatim as `{"error": "Unexpected end of JSON input"}`.

- **Reproduction:** `POST /api/audits` with a question that classifies as a named
  standard, so the classify call runs with `enableWebSearch: true` at 16k max tokens.
  Failed after 37s against staging. Server log:
  `Audit engine error: SyntaxError: Unexpected end of JSON input`.
- **Not caused by the identity changes** made to that route the same day — the request
  got as far as the classify call, so session, company lookup and industry guard all
  passed. Very likely pre-existing; not proven by testing the prior code.
- Two things need fixing together: the guard must cover an empty or unparseable body,
  not only the truncation stop reason; and the failure must not surface as a bare parser
  string. See 2.7 — this is exactly the case where `error_message` should carry the
  first 3000 characters of the raw response so a bad extraction is diagnosable from the
  database days later, and `response_message` should say something an operator can act on.
- Logged, not investigated, by decision.

### 2.7 Two error messages ⬜ ⏱ half day
- ⬜ `response_message` — plain language, always written, success and failure
- ⬜ `error_message` — technical, with the first 3000 chars of raw model output on parse failures
- ⬜ Fix silent failures: storage upload, DB insert, export

### 2.8 Golden-file test set ⬜ ⏱ 1 day
- ⬜ Schema: input, expected, actual, matched, missed, extra
- ⬜ **Test #1 is the 2.5L bottle case with the correct answer written out**
- ⬜ Add every failure found
- ⬜ Re-run after every prompt change or model upgrade

---

## PHASE 4 — Resolution engine

Pure code. No AI. The easiest piece, and the one that most needs tests.

### 4.1 Resolution function ⬜ ⏱ 3 days
Jurisdiction + switches + library version → obligations. Deterministic.

### 4.2 Atomic `replace_obligations` ⬜ ⏱ 1 day
DELETE+INSERT in one transaction with an in-SQL ownership guard. **Half-written obligations are worse than stale ones.**

### 4.3 Determination chain ⬜ ⏱ 1 day
`produces_switch` writes back, re-resolve, cap at 3 passes.

### 4.4 🔒 First tests in the codebase ⬜ ⏱ 2 days
Vitest. The safety properties must be covered:
- ⬜ `unknown` never yields `does_not_apply`
- ⬜ expired evidence never yields `satisfied`
- ⬜ state X never receives state-Y requirements
- ⬜ resolution is idempotent
- ⬜ obligations are never deleted, only marked

Then `npm run check` becomes `typecheck && test && build`.

---

## PHASE 5 — The worker

### 5.1 Worker skeleton ⬜ ⏱ 3 days
`jobs` table as queue · poll loop · compare-and-set claim · per-job-type serialization · stuck-job clearing · progress messaging · cancel checkpoints.

**Never assume a single instance.** Fast lane (documents) separate from slow lane (library generation).

### 5.2 First job: `index_document` ⬜ ⏱ 3 days
Index on upload, not lazily during audit. By audit time every document is already indexed.

### 5.3 Deployment ⬜ ⏱ 1 day
Railway or similar. **The worker does not hot-reload** — restart after every change.

**Two hard limits:** the worker never publishes regulatory content (writes `generated` to a review queue). The determination gate and critic stay synchronous.

---

## PHASE 6 — Library: chemical Oregon

### 6.1 Migrate the rows ✅ **DONE in Phase 1 (11 Sep)**
Superseded by the Phase 1 rebuild. The library is **194 rows — 192 active, 2 retired
parents, 6 split children** — loaded into both environments from
`supabase/seed-data/REQUIREMENTS-FILLED-2026-09-11.xlsx`, every row categorised. It was 188
when this line was written.

### 6.2 Load the switches ⬜ ⏱ 1 day
**~59, not 46.** `substance_exposure_above_action_level` decomposed into one switch per
substance (`DECISIONS.md` §23.1) — each has its own action level, standard and requirement.
Definitions, hierarchy, jurisdiction variants, volatility. The `switches` table exists and
holds **0 rows**; this is what fills it.

⚠️ The seed will be a bulk insert with heterogeneous keys, which needs
`defaultToNull: false` — see the note in migration 008 beside `allowed_values`.

### 6.3 Write `applies_expression` for the active rows ⬜ ⏱ 5 days
**192 active rows.** Free text → machine-evaluable. **Slow, and worth doing slowly.**

### 6.4 Federal layer, agency by agency ⬜ ⏱ 1 week
~95 rows serving every state forever.

### 6.5 Oregon layer, agency by agency ⬜ ⏱ 1 week
**Cite OAR 437, not 29 CFR.** Oregon is a State Plan state.

### 6.6 Primary-source retrieval ⬜ ⏱ 4 days
Every disputed item and flagged specific resolved by **retrieval, not model vote.** eCFR, Federal Register, Oregon OAR/ORS.

### 6.7 Human verification by fact class ⬜ ⏱ 4 days
Dates/fees/thresholds → disputed → critical citations → divergence-table rows → `scope_rules`. ~50–60 rows. Mark `verified` with date **and verifier**.

### 6.8 Standing "confirm before publishing" list ⬜ ongoing
**CFATS is entry #1** — lapsed since July 2023, verified live. Models state it as current with full confidence.

---

## PHASE 6b — Employment law library (Oregon & Washington) *(library #2)*

**Why it is a phase and not a module.** A library is horizontal: employment obligations are
read by the HR module (M3) *and* belong in a chemical manufacturer's overall obligation list,
because they employ people. Same table, tagged `domain = employment` — see M3 for that
argument in full.

**Why second, ahead of cannabis:** it applies to **every** vertical — chemical, cannabis, hospice, brewery. It is the one domain that does not fragment by industry, and it is smaller than chemical.

- ⬜ Agency list: BOLI · Oregon OSHA · Paid Leave Oregon · Oregon Employment Dept · WA L&I · WA PFML · WA ESD + federal DOL, EEOC, FMLA/ADA
- ⬜ Generate agency by agency, same bounded method as chemical
- ⬜ **OR/WA divergences are the high-risk rows:** OFLA vs WA leave, Paid Leave Oregon vs WA PFML, state-fund vs private workers' comp, Oregon CAT vs WA B&O, OAR vs WAC citations, minimum-wage tiers
- ⬜ Employee-count thresholds are the core switch: 10 / 25 / 50 / 100
- ⬜ Primary-source retrieval, then human verification by fact class
- ⬜ Tag rows `domain = employment`

---

## PHASE 7 — Switches and evidence

### 7.1 Public-records lookups ⬜ ⏱ 4 days
EPA RCRAInfo (**generator category, free**), ECHO, TRI, FMCSA SAFER, DEQ/Ecology, SoS, **OLCC licensee list** (cannabis license type, endorsements, tier — free).

### 7.2 Switch determination from documents ⚡ ⏱ 4 days
One AI pass. Every value logs `basis`, confidence, source.

### 7.3 Normalize audit output into `obligation_evidence` ⚡ ⏱ 4 days
**One table resolves three findings:** no resolution tracking, dashboard-only-climbing, audits recomputing from scratch.

### 7.4 Evidence expiry in code ⬜ ⏱ half day
Currently a prompt rule only.

---

## PHASE 9 — Observability

- ⬜ Error tracking, app and worker
- ⬜ Worker heartbeat — today if the worker dies, nothing notices
- ⬜ AI cost tracking per company per task
- ⬜ Rate limiting

---

## PHASE 10 — Cannabis Oregon

- ⬜ **Start by tagging existing OSHA and fire-code rows with `cannabis`** — probably 30–50 rows already owned. Find what you have before generating.
- ⬜ Mine `library_candidates` — usage-ranked, operator-validated queue
- ⬜ OLCC layer (OAR 845 Div 25)
- ⬜ License-type switch hierarchy: producer / processor / wholesaler / retailer / laboratory, endorsements, tier, extraction method
- ⬜ Local layer deep for two or three traction jurisdictions, thin elsewhere and stated
- ⬜ Salesperson verification pass — his license type only, tagged with who and when
- ⬜ OLCC Compliance Education bulletins as a monitored source

**The wedge:** cannabis extraction *is* chemical manufacturing. Flammable storage, LEL monitoring, room classification, hot work, confined space, boilers. Almost every cannabis tool is Metrc-adjacent; nobody covers the side where a fire marshal shuts a room down.

---

## PHASE 11+ — Later

**Washington** — chemical (~90 rows, federal already serves it), then cannabis (near-full rebuild). Divergence table is the mandatory review list. **Generated independently, never seeded from Oregon.**

**Checking agent** — shadow comparison, different model, primary-source tiebreak, seeded known-bad rows, quarterly human spot-check of the checker's judgments.

**Change monitoring** — Federal Register + eCFR APIs, OAR/WAC, agency bulletins, per-agency review intervals.

**Multi-site** — the roll-up dashboard and the site selector, on the structure Phase 1.6 puts
in place. This is interface work; the schema is done by then.

**`memberships` lives here, and only here.** It is not needed for user management — several
people in one company already works on `profiles.company_id`, and what is missing there is
an invite flow, not a migration (see the feature item above, and the correction in the gate).
`memberships` solves exactly one problem: **one person across several companies** — a
consultant serving two clients, or someone spanning facilities that are held as separate
accounts. Rare enough to wait, and it only becomes necessary once a customer actually has
that shape.

⚠️ **`auth_company_id()` is the hard part, and it is bigger than it looks.** It returns a
single `uuid`. Under `memberships` a person can belong to several companies, so it must
either return a **set** (and every policy becomes `company_id IN (SELECT ...)`) or take an
**active-company** parameter (and something must carry that choice through every request).
**59 of 65 policies depend on that function**, plus the four storage policies. Plan it as its
own migration with its own rehearsal — never as a step inside another feature.

Note this is a genuinely large migration whichever day it happens. What changed on 10 Sep is
only that it is no longer *urgent*: it was in the gate as a prerequisite for user management,
which it is not.

**Platform** — Stripe, Drive OAuth, domain, Framer homepage, PDF export, `claude-sonnet-5` (⚡ golden-file pass before and after).

**Key rotation** — moved to the gate at the top, where it belongs. **Six credentials**, not four: the original zip leak on 9 Sep plus both database passwords printed to a terminal on 10 Sep.

---

## MODULES — the vertical slices, built last

Everything above this line is **horizontal**: schema, the runtime pipeline, resolution, the
worker, the library, observability. Each of those cuts across every module in the product.
Everything below is **vertical**: one module at a time, top to bottom, on ground that has
stopped moving.

### Why the plan was reordered

The Compliance Workspace used to sit at Phase 3, in the middle of the horizontal work. That
was wrong in two directions at once.

**It was the only vertical slice among the phases**, which meant it would have been built on
infrastructure still in motion — the determination gate, the critic pass, `company_switches`,
the resolution engine and the worker are all *inputs* to the Workspace, and all of them were
scheduled around it rather than before it. Building a module while its foundations are being
poured means building it twice.

**And the other six modules had no phase at all.** Their findings are real, specific and
already written down — the audit engine silently dropping documents, HR checking a handbook
against eleven hardcoded words, the calendar extracting dates instead of reading cadence —
but they lived scattered through this document as *debts*, filed under whatever gap-closing
session happened to surface them. A debt is something you might pay. Planned work is
something you will do. Most of these are not debts; they are the product.

**This makes the plan longer and more honest: most of the real product work lives in this
final section.** The phases before it are the ground it stands on, and they are short by
comparison because infrastructure is smaller than product.

**Each module below states what it depends on.** Those dependencies are horizontal phases,
and none of them are optional. A module started before its dependency lands is a module that
gets rebuilt.

**One exception, marked where it appears.** M2(a) — the audit engine silently dropping
documents it cannot read — is live in production today, is half a day's work, and should not
wait for its module's turn. Correctness bugs in shipped code are not module work.

---
### M1 — Compliance Workspace

**Design:** `docs/WORKSPACE.md` — the full spec, already written. Nothing below re-decides it.
**Depends on:** determination gate (2.2) · critic pass (2.3) · `company_switches` (1.2) ·
resolution engine (Phase 4). The Workspace is the *surface* over those four; without them it
is a chat box.

#### M1.0 `topics` — the table is deliberately not built ⬜
*Recorded 11 Sep. `DECISIONS.md` §23.2.*

Five of the six Phase 1.2 tables landed in migration 008. `topics` did not, on purpose: it
is the only one whose **shape** waits on a design decision rather than on unwritten code,
and it is the furthest of the six from a caller — the Workspace is this section, the last
in the plan, behind the determination gate, the critic pass, `company_switches` and
resolution.

**Two of `WORKSPACE.md` §9's open questions decide columns, not screens:**

- **§9.4 concurrency** — one open topic per company, or several? One is a partial unique
  index on `(company_id) where status = 'open'`; several is the absence of one. **This is
  not deferrable after the fact.** If several are allowed and users create several, adding
  the constraint later means closing somebody's open work.
- **§9.3 summary format** — what is worth keeping once the transcript is gone. That is the
  content of the column that *is* this table's durable output.

**Already decided, so it is not re-argued when the time comes:** "discarding the
transcript" (§6.1) means **nulling the column and keeping the row**, never deleting the
row. A discarded transcript must still leave behind that a topic existed, when it closed
and why — `close_reason` distinguishes *you closed it*, *a checklist closed it* (§6.2) and
*it went stale* (§6.1), and those read very differently to the person who comes back to it.

#### M1.1 Follow-up classification ⚡ ⏱ 2 days
- ⬜ Elaboration → expansion only
- ⬜ Refinement → update fact, re-run identification → critic → expansion
- ⬜ New question → full pipeline
- ⬜ **Refinement recomputes, never appends**

#### M1.2 Fact capture from conversation ⚡ ⏱ 3 days
- ⬜ Established facts write to `company_switches`; exploration stays in the transcript
- ⬜ Every capture records `basis` — the actual sentence the user said
- ⬜ `user_stated` applies immediately; `ai_inferred` confirms before applying
- ⬜ Confirm when ambiguous

#### M1.3 Scoped questions ⚡ ⏱ 1 day
When a durable fact permits multiple answers, ask the scoped question rather than re-asking the fact. *"You operate your own fleet and also use carriers. For this shipment — which?"* The answer is context, not an overwrite.

#### M1.4 Topic lifecycle ⬜ ⏱ 3 days
- ⬜ Explicit close: summary written, facts extracted, transcript discarded
- ⬜ Tell the user the real reason — past conversations pollute future answers
- ⬜ Auto-close on inactivity
- ⬜ Creating a checklist closes the topic
- ⬜ Flag stale checklists when a fact changes — **flag, never auto-regenerate**

#### M1.5 In-context fact display ⬜ ⏱ 2 days
Before an answer, show **only the facts this question depends on.** Not a wall.

#### M1.6 Answer display ⬜ ⏱ 2 days
Object tags `[the case]`, regime tags `[DOT — transport]`, verification badges. *(Was Phase 8 — Screens.)*

---
### M2 — Audits

**Depends on:** the worker (Phase 5) · `obligation_evidence` normalisation (7.3) · Zod at the
AI boundary (2.6) · the verified library (Phase 6).

**Readiness is rebuilt on evidence rows, not recomputed per run.** Today every audit
recomputes from scratch: it re-reviews documents, re-matches requirements, and produces a
number that has no relationship to the last one. 7.3 normalises audit output into
`obligation_evidence` so readiness becomes a query over stored rows — which is also what
makes resolution tracking and a dashboard that can go *down* possible.

**The whole engine moves to the worker.** See (b) below: this is the clearest case in the
codebase, and moving it returns the route to the service-role key legitimately.

**These findings were surfaced on 10 Sep while moving `/api/audits` off the service-role
key. None is caused by that conversion** — the first predates it and the rest are structural.
They were filed as §0.10, a gap-closing debt; they are module work and now live here.

**(a) A document that fails to download vanishes from the audit, silently. ⏱ half day**
**⚠️ This one does not wait for M2's turn — it is live in production and it is half a day.**
The auto-index loop does `if (dlError || !fileData) continue`. Any cause — a storage
policy, a missing object, a transient network failure, an expired token — drops that
document from the candidate set with no error, no log the user sees, and no record on the
saved audit. The matcher is then shown fewer documents, matches fewer requirements, and the
readiness counts are computed **correctly in code from a smaller input**. Plausible numbers,
wrong basis. `CLAUDE.md` §3.2 puts readiness in code precisely so it cannot be an AI guess;
that protection does nothing when the input quietly shrinks.

The audit should report which documents it could not read, exactly as `/api/hr` now does —
that route names the file and the reason and says the answer does not account for it. Same
treatment here: a `documents_failed` list on the saved audit, surfaced in the UI.

**⚠️ (a) IS NOT THEORETICAL — IT WAS OBSERVED IN A REAL RUN, 10 SEP.**
A re-run on staging returned `satisfied=2 needs_info=1 needs_work=0`. Entirely plausible
numbers. They were computed from **one reviewable document out of eight**: only two of that
company's documents had a real object behind them, one could be read, and the other seven
were dropped by the `continue` with no error, no log the user sees, and no record on the
saved audit.

**This is current production behaviour, not a test artifact.** The same code path runs in
production today. Any cause that makes a download fail — a missing object, a transient
error, a policy problem — silently removes that document from the basis of the answer, and
the readiness figure comes out looking exactly as confident as one built on the full set.

A confident readiness number built on a silently truncated document set is **the precise
failure this product exists to prevent** (`CLAUDE.md` §6, the omniscient status tracker;
§3.2, readiness computed in code so it cannot be guessed). Computing it correctly from
wrong input is not a defence. **Weight this accordingly when the audit engine is next
touched — it is the most consequential item in this section, not a tidy-up.**

**(a2) `matched_documents` can contain entries with no `document_id` at all.**
The same run produced a `matched_documents` array holding an entry whose `document_id` was
`None` — the model returned it that way. Harmless right now because nothing consumes that
array beyond display, but it is on the path to Phase 7.3, which normalises audit output
into `obligation_evidence`. Anything linking evidence from this array would either break on
the null or, worse, skip it silently and record less evidence than the audit found.

Both (a) and (a2) are the same underlying problem: **that array is trusted more than it
deserves.** One is missing entries nobody was told about, the other is malformed entries
nobody validated. Zod at the AI boundary (§2.6) covers the second; reporting unreadable
documents covers the first.

**(b) `/api/audits` is the clearest case for the Phase 5 worker. 🔒**
One request does classify (with web search), generate a full standard on a cache miss,
review every unreviewed document one at a time, and match every requirement in batches.
Minutes, several model calls, unbounded in document count. `maxDuration` is already at 800s
— the highest stable Vercel ceiling without the extended-duration beta — and was raised once
already to work around this. Raising it again is the same workaround with a bigger number.

`PATTERNS.md` §5: BizPulses runs its equivalent as a plain always-on Node process, "separate
from Vercel because classify + N extraction calls + reconcile routinely exceed any
serverless timeout." Same wall, same answer.

**When it moves, it returns to the service-role key legitimately** — a background job has no
user session to run as, the same reason `/api/signup` keeps it. The conversion done on 10 Sep
is superseded at that point, not wrong: it makes the route correct where it currently lives.

**(c) The user gets nothing for the duration of a multi-minute run. ⏱ folded into Phase 5**
No progress, no partial result, no indication anything is happening. BizPulses writes a
`progress_message` after classification and after each chunk, and the browser polls the row
to render it. Phase 5 solves this as a side effect of moving to a job row that can be
updated mid-flight — **record it now so the worker spec includes it**, rather than
rediscovering it after the worker ships without it.

**(d) Port BizPulses's atomic `replace_*` pattern. ⏱ with Phase 4**
DELETE and INSERT inside one transaction, with the ownership guard expressed in SQL, so a
failed refresh leaves the prior data intact rather than half-written. Wanted for
`replace_obligations` (Phase 4.2 already calls for exactly this) and for document re-review.

**One difference that must not be ported.** BizPulses always wants the latest data for a
period and discards what it replaces. CompliBoard often wants the history: obligations are
marked, never deleted (§3.2), and library rows are versioned rather than edited in place.
**The transaction mechanism ports; the retention policy does not.** Take the atomicity and
the in-SQL guard; keep our own rules about what survives.

---
### M3 — HR

**Depends on:** the employment law library (6b) — that is the whole story of this module.
Everything wrong with HR today is downstream of having no verified requirement rows to check
a handbook against.

**Findings from reading the code, 10 Sep. Design decided, nothing built.**

#### The architecture decision
**One requirements table, tagged by domain** — `employment`, `environmental`, `transport`, `fire`, `licensing`. Modules are *views over rows*, not separate systems.

Employment law is an independent **body of law** but not an independent **module**: it is read by HR *and* belongs in a chemical manufacturer's overall obligation list, because they employ people. A separate library would hide it from every vertical.

Two things only work this way:
- **Shared switches.** `employee_count` drives FMLA at 50, OFLA at 25, Oregon sick time at 10 — *and* OSHA recordkeeping thresholds. Determined once, used by both.
- **One company picture.** "What does this company owe?" must return chemical and employment obligations together.

**Test for a new domain:** does it need different *columns*, or just different *rows*? Employment needs the same columns. Same table.

#### What is wrong with HR today
- ⬜ **Audit reads ONE handbook; ask reads ALL of them.** Backwards. SMB reality is one large legacy handbook plus several later amendments, so auditing a single file reports sections "missing" that exist in another document.
- ⬜ **The "requirements" are eleven hardcoded words in a prompt** — anti-harassment, EEO, FMLA, ADA, and so on. No citations, no jurisdiction, no thresholds. FMLA is federal at 50+; Oregon has **OFLA** (25+, broader) and **Paid Leave Oregon** (nearly all employers). A handbook can pass "FMLA present" and miss both Oregon obligations. **A false green produced by a checklist that doesn't know which state it's in.**
- ⬜ **Employee count is never consulted**, so the audit cannot know what applies.
- ⬜ **`draft_policies` required for EVERY missing section** — the highest-risk tier (suggested legal language) shipping unconditionally with no citation, jurisdiction, or verification. **Turn off until a library exists.** Same for `draft_policy` in ask mode.
- ⬜ **Findings are a frozen JSON blob** (`present`/`missing`/`draft_policies` arrays). No per-finding row, no status, no `resolved_by`, no link to the document that closed it. The lifecycle below cannot be built on this shape.
- ⬜ **Ask and audit do not talk.** A question touching a known non-compliant section should report it; there are no finding rows to look up.

#### The intended design
Upload → scan the **whole handbook set** → store **findings as rows** → findings are the durable artifact → questions consult them → a finding stays open until a corrected document actually satisfies it.

- ⬜ Scan once at upload, not per question. Same fix as `obligation_evidence`: compute once, store as rows, query thereafter. Also makes repeat questions consistent.
- ⬜ A new upload **re-scans affected findings**; a finding closes only if the new document actually satisfies it. Never "a document arrived, assume it's fixed" — that is a false green produced by a file.
- ⬜ Record **which document closed a finding and when**. That is the evidence trail.
- ⬜ Report carries a coverage statement: "Reviewed against N employment requirements. X gaps, Y undetermined."
- ⬜ A user can dismiss a finding ("we're under 25 employees") — that writes back to `company_switches`, not just hiding the row.

#### Risk tiers for "here is the fix"
| Tier | What | Gate |
|---|---|---|
| 1 | Missing-section detection | Ship now — an absence is reliably detectable |
| 2 | Anchored comparison against a verified requirement row | **Needs the employment library** |
| 3 | Suggested policy language | Verified rows only, always framed as a draft for counsel |

**Three standing rules:** every finding cites the rule (no citation → no assertion) · never say "you are compliant", only what was checked and found · suggested language is visibly a draft, never a fix to accept.

#### Cheap and honest, available now
- ⬜ Audit reads all handbooks
- ⬜ Drop `draft_policies` / `draft_policy`
- ⬜ Label the output a **generic completeness check**, not a compliance finding

#### Already good in the code
- ✅ Conflict handling is in the ask prompt — names which handbook says what, does not silently pick
- ✅ Ask mode reads all handbooks so an answer in an older document is still found
- ✅ Four-outcome answer shape with citations *(written 10 Sep, untested)*

---
### M4 — Documents

**Depends on:** the worker (Phase 5, job type `index_document` is already 5.2) · the schema
rebuild (Phase 1) for the versioning columns.

**Findings not yet written up in the detail M2 and M3 have.** What is known:

- ⬜ **Review runs inline, per request, and the same document gets reviewed twice.**
  `lib/documentReview.ts` is called from the manual Review button *and* from the audit
  engine's auto-index step. It is a multi-second model call with a whole PDF in the
  payload, sitting in a serverless request. It is 5.2's job — **index once at upload,
  store the result, query it thereafter.** Same shape as `obligation_evidence` and the HR
  findings: compute once, store as rows, read many times.

- ⬜ **"What is this document about" is prose, not a key. ⏱ with Phase 1**
  The review prompt returns `document_type` and `regulation_reference` as free text —
  *"OSHA 29 CFR 1910.1200 (HazCom)"*, as specific as the model felt like being. Nothing
  joins that to a requirement row. Evidence matching currently re-reads the document
  because there is nothing indexed to match *against*. Indexing must produce something
  joinable — agency, citation, requirement ids — alongside the prose a human reads.

- ⬜ **Nothing records that one document supersedes another. ⏱ with Phase 1**
  The SMB reality named in M3 is one large legacy document plus a series of later
  amendments, and that is just as true of permits, SDS sheets and plans as it is of
  handbooks. Today an expired permit and its renewal are two equal rows; the product has
  no way to say the second replaced the first. Without it, "is this current?" is answered
  per file rather than per obligation, and a superseded document can still satisfy a
  requirement. `supersedes_id` is already in the Phase 1 schema work for library rows —
  customer documents need the same treatment, and the answer must survive into
  `obligation_evidence`.

- ⬜ **`app/documents/page.tsx` is 1,103 lines.** Split when the module is worked, not
  before — a rewrite ahead of the indexing change is a rewrite done twice.

- ⬜ `app/upload/page.tsx:89` calls `getPublicUrl` on a private bucket — already broken,
  already listed in §0.7. Fix it there, not here.

---
### M5 — Calendar

**Depends on:** the library (Phase 6, cadence lives on requirement rows) · resolution
(Phase 4, which says what applies) · `obligation_evidence` (7.3).

**The change: cadence comes from obligations, not from date extraction.**

Today `/api/extract-dates` sends a document to the model with a prompt asking it to find
"expiry dates, renewal dates, inspection due dates… maximum 10 dates per document," and
writes what comes back into `calendar_events`. The calendar is therefore a list of dates
somebody's paperwork happened to mention. It cannot know about an annual report that is due
whether or not any document says so, and it cannot tell a deadline that binds this company
from a date printed on a form.

A requirement row carries its own cadence, and resolution already determines which rows
apply. **The calendar becomes a query over obligations** — deterministic, complete, and
explainable back to a citation. `MERGEDv2` already contains a fixed-date calendar (6.1).

- ⬜ Calendar reads cadence from obligations ⏱ 2 days
- ⬜ **Extraction survives for exactly one job:** the date the law cannot know — *this*
  permit's expiry, *this* inspection's result. That is anchored to an artifact and is the
  mode the model is reliable in (`CLAUDE.md` §3.3). Enumerating a company's deadlines from
  a document is the unanchored mode.
- ⬜ Every calendar entry states its basis: the obligation and citation behind it, or the
  document the date was read from.
- ⬜ Decide what happens to the entries extraction has already written. They are not
  wrong, they are unsourced.

---
### M6 — Dashboard

**Depends on:** `obligation_evidence` (7.3) · the verified library (6.7) · `industry_coverage`.

**Real metrics only once evidence rows exist.** The dashboard today can only climb: there is
no stored evidence, so nothing can be un-satisfied, and a number that only goes up is not a
compliance measure — it is a progress bar. Once 7.3 writes evidence as rows, readiness is a
query, an expiring certificate makes the number **fall**, and the figure means something.

**Until then, no numbers.** `CLAUDE.md` §6 names the omniscient status tracker as an
anti-pattern and it was removed from this product once already. A percentage computed over
an unverified library is that anti-pattern wearing a chart.

- ⬜ Readiness computed in code from evidence rows — never AI, never a running total ⏱ 2 days
- ⬜ **Enable numbers — gated on library verification (6.7).** This is the gate, not a step.
- ⬜ Requirements page, grouped by agency ⏱ 4 days
- ⬜ Coverage strip from `industry_coverage` ⏱ 1 day — `OSHA ✓verified · DEQ ✓verified ·
  Local fire ◐partial · ODA ○not built`. A verified row and a generated row must not look
  the same.

#### M6.1 Verification section ⬜ ⏱ 2 days
*(Designed in `WORKSPACE.md`; it lives on the dashboard, so it is planned here.)*
- ⬜ Three at a time, never more
- ⬜ Ranked by consequence internally
- ⬜ **No numbers** until the library is verified
- ⬜ Empty state is the good state
- ⬜ Frame as an inbox that gets quiet, not a burn-down

---
### M7 — Onboarding and signup

**Depends on:** the worker (Phase 5 — the website scan becomes a background job) ·
`library_candidates` (1.2).

**Full design in `WORKSPACE.md` §10.** This is the first thing a customer ever sees and it
is currently a dropdown listing only the verticals already built — a signup form that can
only be completed by someone we have already decided to serve.

- ⬜ Remove the industry dropdown and `/api/industries` — it is circular, offering only verticals already built
- ⬜ Signup collects **email, password, website, address** only
- ⬜ **Address required** — it decides which body of law reaches them; not derivable from a website
- ⬜ **Geocode the address for state, county and city** — US Census Bureau Geocoder, no API
  key, effectively unlimited. Not typed by the user and not inferred by a model: it is a
  lookup with a known correct answer, and a wrong county silently changes which
  requirements apply. **A geocode failure leaves the jurisdiction unknown and asks — it
  never substitutes.** `DECISIONS.md` §25.1
- ⬜ **Ask for the fire authority. One field.** Geocoding cannot produce it — fire districts
  do not follow county lines, and Tualatin Valley Fire & Rescue spans three counties. The
  customer knows, because a fire marshal has visited them. Unknown means the three `local`
  fire-code requirements show undetermined rather than resolving against a guess.
  `DECISIONS.md` §25.2
- ⬜ **Capture `county`** — signup hardcodes `county: ''` today, so **no county-scoped
  requirement can resolve for anyone**. Geocoding is what fills it
- ⬜ Scan runs as a background job, not inline; do not block signup
- ⬜ Scan output carries a **sufficiency confidence**, not just extracted fields
- ⬜ `primary_industry` + `secondary_activities[]`, with `basis` and `resolved_by`
- ⬜ Classification presented as a **teaching confirmation**, correctable
- ⬜ Three distinct fallback messages: no website · unreachable · uninformative
- ⬜ Unmatched industries write to `library_candidates` — signup becomes demand research
- ⬜ Company profile screen — *"here's what we understand, correct anything wrong"* ⏱ 4 days
- ⬜ Onboarding: 3 fields → scan → confirm screen → ~7 questions → documents ⏱ 5 days

**Why classification is a teaching confirmation and not a form field.** The confirm screen is
the first time the product tells the customer what it thinks they are, and the first time
they can correct it. Getting that wrong is not a UX blemish — jurisdiction is part of the
match key (`CLAUDE.md` §3.2), so a misclassification serves the wrong body of law silently.

---

### M8 — Account

**Depends on:** nothing. That is the point of it being here rather than in a phase.

`/api/account` (GET, PUT, DELETE) and `/api/account/export` both work — converted to the
caller's token on 10 Sep and verified by comparing row counts against the service role.
Migration 005 exists because the export was silently dropping every colleague from a
customer's data export: right shape, right status, fewer people.

What is missing is everything to do with **who else is on the account**.

#### M8.1 Invite, list, remove ⬜ ⏱ estimate after reading BizPulses

*Moved here 11 Sep. It had been sitting between Phase 0 and Phase 1, belonging to neither
and scheduled by nothing.*

**Not a gap in the security work — a missing feature the security work made visible.**
**It needs no migration. It works on the schema that is in production today.**

There is no way to add a person to an existing company, and no way to remove one.

- **Nobody can be added.** The only path that creates a profile is `/api/signup`, and it
  creates a **new company** every time. A second person cannot be given access to an
  existing company at all. So the company-scoped visibility built in migrations 003 and
  004 currently has no users to be scoped *between* — every company has exactly one
  person, by construction. **By construction, not by schema:** two `profiles` rows sharing
  a `company_id` is a legal, working state. It was run on staging on 10 Sep — Test Alpha
  Chemical had two users and each saw the other's checklists, which is exactly the intent.
  What is missing is the route that creates the second row.
- **Nobody can be removed.** `profiles` has no DELETE policy and no route. The only
  deletion path is `/api/account` DELETE, which destroys the entire company.

**The consequence, stated plainly:** when an employee leaves, their login keeps working
indefinitely. They keep full read and write access to every document, audit, permit and
piece of evidence at that company, and can still delete things. For a product whose value
is holding a customer's compliance evidence trail, that is a real exposure.

**Policies do not fix this.** Migrations 002–005 make the database enforce that a person
sees only their own company's data. A departed employee is *still a legitimate member of
that company* as far as the database is concerned — their profile row still says so. RLS
is working exactly as designed and the wrong person is inside the boundary. No amount of
policy work closes it; only a way to revoke membership does.

**Scope**

- Invite a person to an existing company
- List who has access
- Remove access
- **Records created by a removed person must survive.** The compliance record is a company
  asset (`DECISIONS.md` §1, §14) — removing a person must not remove their document
  reviews, audits or checklists, or a departure silently deletes evidence. Practically:
  revoke the login and mark the profile inactive; never cascade a delete through their work.
- Decide whether roles are needed, or whether everyone at a company is equal

**Ships on its own timeline — and ships, rather than being stockpiled.** It is not gated on
any phase, so it can be built whenever a customer needs it. The rule is that it goes to real
users when it is built. **Code written and held back is code that has never been tested
against real use**, and an invite flow is exactly the kind of feature where the first real
attempt finds the problems — an email that does not arrive, a link that expires, an invitee
who already has an account with another company.

**Port from BizPulses rather than designing fresh** — it already has invite, list and remove,
and the flow is the valuable part. **But its `memberships` table is not the part to copy.**
That table solves a different problem: **one person across several organisations.** Our
problem is several people inside one company, and `profiles.company_id` expresses that fine.
`PATTERNS.md` §3 has its RLS pattern; note that we already improved on it — a `SECURITY
DEFINER` helper instead of the subquery repeated in every policy, and explicit `WITH CHECK`
rather than relying on Postgres reusing `USING`. Take the flow, not the schema.

**The cost of the interim, recorded so it is a choice and not an accident.** Until this
ships, early customers with more than one person share a login. That is tolerated
(`DECISIONS.md` §17.4) and it **weakens the audit trail**: every write records `user_id`, so
a shared login attributes every document upload, every checklist tick and every audit run to
one person. *"Who marked this complete, and when"* is part of what a compliance record is
for — it is the thing a regulator or an insurer asks. A shared login does not corrupt the
record, but it flattens it, and the flattened rows cannot be un-flattened afterwards.

**Prerequisite already done:** migration 005 gives `profiles` a company-scoped SELECT
policy — **applied to production 10 Sep** — which is what makes "list who has access"
possible at all. It changes nothing visible today: production has four companies with one
person each, so nobody has a colleague to see.

#### M8.2 The cost of waiting, taken knowingly ⚠️

**Early customers with more than one person share a login. That is accepted
(`DECISIONS.md` §17.4), and it has a price that should be visible rather than implicit.**

Every write records `user_id`. Under a shared login that is one person's id on every
document upload, every checklist tick, every audit run and every piece of evidence —
regardless of who actually did it.

**"Who marked this complete, and when" is not a nice-to-have for this product. It is a
large part of what a compliance record IS** — the question a regulator, an insurer or an
auditor asks first. A shared login does not corrupt the record; it **flattens** it.

And the flattening is permanent. **Records created under a shared login stay ambiguous
forever**, because the information was never captured — shipping the invite flow later
fixes every subsequent row and no earlier one. That is the real cost of deferring: not
that the feature is late, but that a window of the customer's history is ambiguous for the
life of the account.

**Taken knowingly.** The trade is that an invite flow is not what stands between here and a
first customer, and a customer who knows the limitation can work within it. It should be
said out loud during those conversations rather than discovered during an audit.

---

## Next three sessions

**Session A — close the remaining holes** (0.4, 0.5, 0.6, 0.9) — ✅ **done, 10 Sep**
All four landed. Migrations 002–005 are in production, every route derives the company from
the verified session, ten routes run under RLS on the caller's token, and the four that keep
the service-role key each carry a named reason. §0.7 housekeeping is what remains of Phase 0.

**Session B — schema rebuild** (1.1–1.6) ⏱ ~1.5 weeks
Design, migrate, rebuild staging from zero, rebuild production, jurisdiction in the match key,
multi-facility structure. **Do this before the first real customer document** — it is item 2
of the gate at the top.

**Session C — the runtime fixes** (2.1–2.4)
Agency list, determination gate, critic pass, split identification from expansion. **This is where answer quality changes.**

**Not yet: any module.** Everything in `MODULES` waits on B, C and the phases after them.
The single exception is M2(a) — the audit engine silently dropping documents it cannot read.
That is live, it is half a day, and it does not wait.

---

## Open decisions

1. Pricing — $199 or $99
2. Cannabis prospect — processor or not? one license entity or six?
3. What the other two salespeople are targeting. A single-site Oregon chemical manufacturer is the cheapest validation of this whole architecture, and the one you can verify personally.
4. Auto-close interval for topics
5. One open topic at a time, or several?
6. How aggressively to confirm before writing a fact
