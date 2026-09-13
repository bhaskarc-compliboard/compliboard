# STATUS

**Version:** 14 · **Updated:** 13 September 2026
**Supersedes:** version 13 (13 Sep). **The mechanism is proved end to end by a person and the content is not.** Cases E, F, G and I pass: the first GET writes, the reload is idempotent, the pre-existing obligation was closed rather than deleted, both empty states render. **Then a ten-minute domain read of the rendered rows found what 199 expression reviews had not** — 22 of 216 switch clauses can never be true, so **a large-quantity generator receives zero hazardous-waste obligations and is told so confidently.** `applies_expression` moves to ⛔ broken; `DECISIONS.md` §64, check 28, `TODO.md` 6.4c, which gates showing `does_not_apply` to any customer. **023 is on staging only** — production stays on 022 until Case E had passed, which it now has. Version 13: **The obligation writer had never run through its own route** — proved by a service-role script, which made every later request skip the write. As the caller it holds EXECUTE on neither function it calls and returned **500 for every uncomputed company**, which on production is all ten. Found by the manual set on its first run (`DECISIONS.md` §63). **Migration 023 is on staging and NOT on production**, so the two environments now differ by one migration and production would still 500. Version 12: **The chain runs end to end for the first time.** A question is
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
| **Audits** (`/audits`) | 🟡 degraded | 12 Sep | **12 Sep: the critic pass now runs before the audit row is written**, on the evidence question set — the one that asks how many documents were available against how many were used. It does not fix the defect below; it makes it visible in the answer. **And the defect is now measured, not just observed:** six audits of the same 272-item ISO 9001 standard for the same company returned `satisfied` of 6, 9, 7, 15, 13 and 21 — **a 3.5× spread**, with 219 of 272 items citing no document at all in the worst run (`AUDIT-CHECKS.md` check 16). | **11 Sep: an unreadable attachment now returns 400 with the reason instead of a 500 saying "Something went wrong", and Excel and CSV are read where they previously were not.** Unchanged and still the headline defect: **Silently drops documents it cannot read.** Observed in a real run: `satisfied=2 needs_info=1` computed from **one readable document out of eight**, the other seven dropped by `if (dlError \|\| !fileData) continue` with no error and no record. Plausible numbers, wrong basis — `TODO.md` M2(a). Also `matched_documents` can contain an entry with a null `document_id`. |
| **HR** (`/hr`) | 🟡 degraded | 11 Sep, by reading the code — **not run** | **`.docx` handbooks now reach the model.** Until 11 Sep this route accepted PDFs and images only and told the user the format was unreadable — the parsers existed all along and the restriction was a workaround for a mislabelled upload (`DECISIONS.md` §28.2). Most handbooks are `.docx`, so the module's core input was the one thing it refused. Still degraded, unchanged by this: audit reads **one** handbook while ask reads all; requirements are eleven hardcoded words with no jurisdiction or thresholds, so a handbook can pass "FMLA present" and miss both Oregon obligations; `draft_policies` ships suggested legal language unconditionally. `TODO.md` M3. **The route's own file picker is still `.pdf,image/*`** and was not widened — see the note below. |
| **Documents** (`/documents`) | ✅ working | 11 Sep | All four methods converted to the caller's token and verified by per-table row-count comparison against the service role. **11 Sep: picker widened to the shared list, and a document that cannot be read now says so instead of reporting "no dates found" on a file nobody opened.** Debts, not breakage: review runs inline and twice per document; nothing records what a document supersedes (`TODO.md` M4). |
| **Calendar** (`/calendar`) | ✅ working | 11 Sep | Converted and verified the same way. **11 Sep: an unreadable import now says why, instead of "No compliance dates found in this file. Make sure it contains deadline or expiry dates." — shown for documents that had been rejected before any date-finding ran** (`CLAUDE.md` §5.1, `DECISIONS.md` §27). **Its picker is still narrower than its route** — no images, though `/api/extract-dates` reads them. Debt: dates are extracted from documents rather than read from obligation cadence (`TODO.md` M5). |
| **Dashboard** (`/dashboard`) | ❓ unknown | — | **Not exercised this session.** Reads calendar, document reviews and checklists — **not** obligations — so the empty obligations table does not affect it. That is from reading the page, not from running it. |
| **Compliance workspace** (`/compliance`) | ❓ unknown | — | **Changed substantially on 11 Sep and still not exercised by a person.** The determination gate now runs on every question it asks (`docs/DETERMINATION-GATE.md`), so a question missing a blocking fact returns an amber card asking for one thing instead of a checklist. **It now requires a login** — every call sends the session token. The gate's two behaviours were verified against staging by `npm run golden`, not by clicking. `docs/TESTING.md` has the manual set. Previously: Its uploads now reach the model as content rather than as a filename (`DECISIONS.md` §28.1), the picker matches the shared list, and it gained its first error display: it previously had no error state at all, so a failed request showed a blank. The 1,282-line page predates the Workspace design in `WORKSPACE.md`; that design is M1 and unbuilt. |
| **Signup** (`/signup`) | 🟡 degraded | 11 Sep | **Was ⛔ broken in production for roughly two hours today** — migration 007 renamed `industry` → `industries[]` and `/api/industries`, the only caller, kept selecting the old name, so the dropdown came back empty and blocked signup. **Fixed and verified 11 Sep.** Still degraded: does not capture `county`, and `employee_count` is never asked for (writes NULL). |
| **Upload** (`/upload`) | 🟡 degraded | 12 Sep | **12 Sep: now sends the session token, since `/api/chat` requires one.** `app/upload/page.tsx:89` calls `getPublicUrl` on a private bucket — **still broken**, predates this work, `TODO.md` §0.7. 11 Sep: picker widened to the shared list, and a refused file now reaches the error banner this page already had instead of a bare `catch {}` commented *"extraction failed silently"*. |

## Infrastructure

| Piece | State | Verified | Notes |
|---|---|---|---|
| **Tenancy / RLS** | ✅ working | 11 Sep | **65 policies across 23 tables, 59 of them through `auth_company_id()`** (read from the database, not recalled). `anon` holds zero grants anywhere. Verified by comparing row counts under a caller's token against the service role, not by HTTP status. |
| **Storage scoping** | ✅ working | 10 Sep | Six tests with real sessions: a company can read and write only its own prefix. Before migration 002 every authenticated user could read and delete all 52 files across 7 companies. |
| **Migration chain** | ✅ working | 13 Sep | **000→022 on both environments**, read from `supabase_migrations.schema_migrations`: production reports `applied: 23, latest: 022`. **Object-for-object comparison after 022: 0 differences across 10 categories** — 26 tables, 1 view, 394 columns, 94 enum labels, 6 functions, 80 indexes, 71 policies, 121 constraints, 13 triggers, and **0 `anon` grants on either side**. `npm run db:reset` rebuilds staging from empty and replays the chain; running it the first time found two migrations that had never been able to build from nothing. 012 was refused on its first attempt — a CHECK constraint may not contain a subquery — and rolled back whole, which is the transaction-per-file behaviour working. |
| **Requirement library** | 🟡 degraded | 12 Sep | **205 rows in both environments — 200 live, 5 retired parents, 17 split children, 0 orphaned lineage.** **The library grew from 194 rows to 205 and NOT ONE is new regulatory content.** Migration 013 split three under-decomposed rows — Electronic OSHA injury-data submission into 3, Process Safety Management into 5, Permit-required confined spaces into 3 — so 11 children replaced 3 parents: total 194 → 205, live 192 → 200. Every child's text is derived from its parent's (`CLAUDE.md` §5, and the split test is `DECISIONS.md` §44.4). **193 of 200 live rows carry a regulator**, 7 deliberately NULL. Jurisdiction: 99 Oregon at state layer, 3 Oregon local, 95 federal, 3 with no layer. **Degraded on one axis and it is the important one: all 200 live rows carry a citation, and 0 carry a `citation_url`, a `citation_quote` or a `source_checked_at`. 0 are at `status = 'verified'`.** Every row names a rule and not one links to it. `AUDIT-CHECKS.md` check 1. |
| **Agency list** (`agencies`) | ✅ working | 12 Sep | **33 agencies in both environments** — 14 federal, 16 Oregon, 3 local. Shared regulators carry both industry slugs; none is duplicated. `url` is NULL on every row **deliberately** — an unverified link is the fact class `CLAUDE.md` §6 says must carry a badge, and this table has no badge column (`TODO.md` 2.1). Washington's regulators are absent on purpose (`DECISIONS.md` §32). |
| **Requirement → agency assignment** | ✅ working | 12 Sep | **187 of 194 requirements carry a regulator**, from a reviewable mapping table (`supabase/seed-data/agency-mapping.json`), identical in both environments. **The 49 Oregon rows citing 29 CFR resolve to Oregon OSHA, not federal OSHA** — the line the whole mapping exists to get right. 7 are deliberately NULL: 3 contractual, 2 genuinely ambiguous, 2 with no enforceable citation. |
| **Coverage table** (`industry_coverage`) | 🟡 degraded | 12 Sep | **56 rows in both environments, all `not_built`, 32 of them with nothing behind them.** The data is right and **nothing renders it** — no reader exists outside the loader, so the coverage strip `CLAUDE.md` §6 describes does not exist. Degraded rather than working because the honest signal is computed and invisible. `row_count` counts live rows only (`AUDIT-CHECKS.md` check 4). |
| **Switch library** (`switches`) | 🟡 degraded | 12 Sep | **95 switches in both environments, 40 dependency edges, 0 cycles, graph walked from each database and compared** — 95 nodes reached, 55 roots, 40 children, max depth 1, depth maps identical. 73 site-scoped, 22 company; 6 numeric carrying their thresholds. Derived from 188 requirement trigger strings rather than from the design document — `DECISIONS.md` §36. **Degraded on one axis that is now measured: 42 of the 95 — 44.2% — have NO determination path even after Phase 7.2 ships** (29 need an ask path, 11 need signup to collect them, 2 need 6.3b wiring). `AUDIT-CHECKS.md` check 23. **12 of the 95 are referenced by no requirement condition**; 4 of those are context rather than triggers, 8 are the 6.3b backlog. |
| **Requirement conditions** (`applies_expression`) | ⛔ broken | 13 Sep | **199 of 200 live requirements carry a condition, and 22 of the 216 switch clauses CANNOT EVER BE TRUE.** Seventeen compare the `hazwaste_generator_category` enum `{none,vsqg,sqg,lqg}` against the boolean `true`. **Proved by running the resolver at `lqg`, `sqg` and `vsqg`: identical output every time, `{does_not_apply:17, unknown:3}`, APPLIES NONE** — a large-quantity generator receives zero hazardous-waste obligations and the screen says so in a confident sentence naming the fact that supposedly ruled them out. The customer's answer never mattered. **Broken rather than degraded because the product makes a false negative claim on its own authority** (`CLAUDE.md` §3.2's direction, inverted). Three further shapes are type-correct and invisible to any query — federal exemptions clearing Oregon rows, switches that restate their own requirement, switches narrower than the rule they gate. `AUDIT-CHECKS.md` check 28, `DECISIONS.md` §64, work is `TODO.md` 6.4c. Found by a ten-minute domain read of the rendered screen; 0 dangling switches and 0 invented numbers, so checks 19 and 21 both pass. |
| **Resolution engine** (`lib/resolve.ts`, `lib/jurisdiction.ts`) | ✅ working | 13 Sep | **Layer 3, and it contains no AI. Wired to a route as of 13 Sep** — `/api/obligations` computes on the first GET and persists through `close_and_replace_obligations`. Jurisdiction + switches + library → obligations, deterministically. Six-case match key as a pure predicate; company-level expressions evaluated once per site and combined with a three-valued existential; `unknown` never resolves to `does_not_apply` anywhere in the chain. **245 tests across the suite, and all nine of the engine's safety properties proved by breaking them** — `npm run mutation` applies nine plausible wrong implementations and all nine are caught. |
| **`close_and_replace_obligations`** | ✅ working | 13 Sep | **In both environments (016), amended on staging by 023.** Closes changed or departed obligations by setting `applicable_to` and inserts the new ones, in one transaction — **no DELETE**, because obligations are history (`DECISIONS.md` §47). **13 Sep: EXECUTE granted to `authenticated` with a caller-identity guard inside** — a signed-in user passing another company's id is refused by name (`caller belongs to company X, not Y`, verified live, the other company's 221 obligations unchanged after the attempt). RLS is what makes that safe; the guard is what makes it legible. `anon` holds nothing. **An empty payload is valid and always was**: every guard counts rows and gets zero, the close closes what is open, the insert inserts nothing. Exercised on **staging only**. |
| **Switch determination** (7.2) | 🔧 not-yet-rebuilt | 12 Sep | **The schema and the logic exist; NO ROUTE CALLS THEM — verified, not assumed: the four files that name `company_switches` or `switch_determinations` are comments or the account-deletion list, and `tests/golden-documents/` does not exist.** Migration 017 adds `evidence_class`, the append-only `switch_determinations` history, and `company_switches.determined_from` — with a **composite FK pinning the denormalised class to the determination it came from**, so the copy cannot drift. `prompts/switch-determination.ts` carries seven forbidden inferences, the first being that absence is never a determination. `lib/switchDetermination.ts` holds the precedence ladder (`user_locked` → evidence class → recency **within a class** → issuer authority → `needs_user`) and `lib/sdsExtraction.ts` the CAS check-digit guard. **Not built: the routes and the golden document cases**, the latter blocked on which documents may be committed to the repo. |
| **Chemical inventory** (`company_chemicals`, `regulated_substances`) | 🔧 not-yet-rebuilt | 12 Sep | **Both tables exist in both environments and both hold 0 rows. That is the expected state, not a gap.** `regulated_substances` is reference data keyed by CAS number — EHS, TRI, PSM, RMP and CERCLA thresholds — and is not seeded yet; `company_chemicals` is per-customer inventory and there are no customers. **With both tables empty, `substance_inventory()` returns `unknown` — not `false` — for every site, verified against the function body rather than assumed:** the first branch is `when not exists (… company_chemicals …) then null`, because a site nobody asked is not a site below the threshold. And once customers exist but `regulated_substances` is still empty, every inventory row matches no substance and is therefore unevaluable, which lands on the same `null`. **There is no state in which an unseeded reference table produces a clear.** Seeding it is 6.4. 15 of the 199 conditions depend on it. The tables are here already because migration 014's semantics — an unidentified chemical makes the answer **unknown**, not false — had to be designed before any data arrived, not retrofitted after (`DECISIONS.md` §45). |
| **Critic pass** (Stage 5) | 🟡 degraded | 12 Sep | Working and correct; **degraded on latency, and the cause is structural rather than a tuning problem.** Measured across 12 runs: **84s average, 37–151s.** It is the most expensive call in the product — more than generation (30s avg) and the gate (6–10s) combined. **The cause is that it is handed all 31 agencies with jurisdiction, because Stage 2 does not exist to narrow the list to the ones this question touches** (`docs/CRITIC-PASS.md` §5). **Do not optimise the prompt or lower the tier — narrowing the input is the fix, and it is Stage 2's job.** Other detail below. |
| **Critic pass — detail** | ✅ working | 12 Sep | **Live on `/api/chat` checklist mode and `/api/audits`**, on the strongest model tier. A fresh call that sees only the output — never the prompt that produced it. **It never rewrites**: findings are applied in code by severity, so a wrong item is withheld with its reason rather than regenerated (`DECISIONS.md` §39). Verified against the frozen 2.5L artifact in `baseline-outputs/`: 13 findings, 7 blocking, all seven known errors caught plus four nobody had recorded. Negative control held — 0 blocking on a verified-correct answer. Not yet exercised by a person. |
| **Model tier routing** | ✅ working | 12 Sep | `judgement` · `critique` · `prose` · `default`, private to `lib/ai.ts`. **And it surfaced a latent bug**: the Claude 5 family rejects `temperature` outright, six call sites pass it, and `AI_MODEL=claude-sonnet-5` would have 400'd all six. The pipe now drops the parameter where it is not accepted. `AUDIT-CHECKS.md` check 15. |
| **Determination gate** (Stage 1) | ✅ working | 12 Sep | **6–10s, the cheapest stage.** **Live on `/api/chat` and `/api/audits`.** **12 Sep: the facts it establishes now reach the generating call** — until then `g.resolved` went into the HTTP response and nowhere else, so the model writing the answer was never told what the gate had determined (`DECISIONS.md` §41). Before any answer it decides what facts the question turns on and asks for one if a blocking fact is missing. Verified against staging by `npm run golden`: the 2.5L bottle case asks for the SDS; the Oregon minimum-wage case proceeds without asking, treating jurisdiction as already known. `substeps` is deliberately not gated. Not yet exercised by a person — `docs/TESTING.md` has the manual set. |
| **`company_switches` / candidates / jobs** | ✅ working | 13 Sep | **`company_switches` has its first rows: 16 on staging for Test Alpha, across 9 distinct switches, all `source = user_set` and `state = known`** — written by the ask path, not by a seed. **Production holds 0, correctly**: no customer has answered anything. `library_candidates` and `jobs` remain empty with no caller, waiting on Phase 5 — ahead of their users on purpose, not a gap. |
| **Obligation writer** (`lib/obligationWriter.ts`, `/api/obligations`) | ✅ working | 13 Sep | **Phase 4.3. Exercised end to end through the route by a person, 13 Sep** — `TESTING.md` Cases E and F pass: the first GET writes, a reload is idempotent, and a pre-existing hand-seeded obligation was **closed rather than deleted**. Until migration 023 it had never once run through its own route: the 1.95 s / 221-obligation measurements were taken by a script holding the service-role key, which set `obligations_computed_at` so every later request skipped the write, and as the caller it held EXECUTE on neither function it calls — **a 500 for every uncomputed company** (`DECISIONS.md` §63). **023 is on staging only; production remains on 022**, where all 10 companies are NULL and would still 500. |
| **Multi-facility structure** | ✅ working | 11 Sep | Every company has exactly one primary site, **in both environments**. Production's 10 were backfilled by 010 and the trigger is armed, so a new company gets its site in the same statement that creates it. Sites carry their own state, county, city and fire authority. |
| **Worker** | ⬜ not built | — | Phase 5. The `jobs` table exists; nothing polls it. |
| **Resolution engine** | ⬜ not built | — | Phase 4.1. Until it exists, obligations stay empty — which is the Requirements line above. |

## Known-wrong, whole-product

These are true regardless of which screen you are looking at.

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
  PowerPoint though `/api/audits` now reads all three; `/hr` offers `.pdf,image/*` though
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
