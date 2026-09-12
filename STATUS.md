# STATUS

**Version:** 5 · **Updated:** 12 September 2026
**Supersedes:** version 4 (12 Sep). Adds the critic pass and model tier routing, and records
the audit consistency spread now that it is measured. Version 4 recorded phases 2.1, 2.2 and 6.2: the agency list and
requirement assignment, the determination gate, and the switch library. Version 3 recorded
the document-parsing unification. Version 2 corrected version 1, which said production was
on 009 when it was on 007.
**Environment:** **staging and production both on 000–012**

> ✅ **The two environments are the same shape.** Compared object for object — tables,
> columns with type and nullability and default, constraints with definitions, indexes,
> policies with their USING and WITH CHECK, triggers, functions and enum values —
> **619 objects each, zero differences, in either direction.** Verified 12 Sep after 011 and
> 012 landed in production. Table ACLs and RLS flags compared separately across all 23
> tables: identical, and `anon` holds nothing on either side.
>
> **619 is not a drop from the 673 this file reported after migration 010.** It is a
> differently-built census: the earlier one counted grants through
> `information_schema.role_table_grants`, which filters to roles the caller belongs to and
> returns nothing here, so grants are now compared separately from `pg_class.relacl`.
> Nothing went missing. `AUDIT-CHECKS.md` check 10 records that whichever census the check
> settles on has to be the same one every time, or the count itself becomes a false alarm.
>
> This file previously said production was on 009 when it was on 007. That was written from
> recollection rather than from the database and was caught by a pre-flight. **Every count
> in this file is read from the database, and was re-read on 12 September.**

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
| **Requirements screen** (`/requirements`) | 🔧 not-yet-rebuilt | 12 Sep | **The library behind it is now complete and assigned** — 194 rows, 187 with a regulator, 90 switches seeded. The screen still shows nothing, because obligations are what it renders and obligations are produced by resolution. Migration 007 dropped the 376 obligations — derived output, and they carried the jurisdiction defect. Nothing regenerates them until the resolution engine exists (**Phase 4.1**). `/api/obligations` returns `[]` with a 200 and the page renders empty. **Expected. Not a regression.** |
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
| **Migration chain** | ✅ working | 12 Sep | **000→012 on both environments.** `npm run db:reset` rebuilds staging from empty and replays the chain; running it the first time found two migrations that had never been able to build from nothing. **012 was refused on its first attempt** — a CHECK constraint may not contain a subquery — and rolled back whole, leaving staging on 011 with nothing half-applied. That is the transaction-per-file behaviour working. |
| **Requirement library** | 🟡 degraded | 12 Sep | 194 rows in both environments — 192 live, 2 retired parents, 6 split children with resolved lineage, every row categorised and 187 assigned a regulator. **Degraded on one axis and it is the important one: 0 of 194 carry a `citation_url`, a `citation_quote` or a `source_checked_at`, and 0 are at `status = 'verified'`.** Every row names a rule and not one links to it. `AUDIT-CHECKS.md` check 1. |
| **Agency list** (`agencies`) | ✅ working | 12 Sep | **33 agencies in both environments** — 14 federal, 16 Oregon, 3 local. Shared regulators carry both industry slugs; none is duplicated. `url` is NULL on every row **deliberately** — an unverified link is the fact class `CLAUDE.md` §6 says must carry a badge, and this table has no badge column (`TODO.md` 2.1). Washington's regulators are absent on purpose (`DECISIONS.md` §32). |
| **Requirement → agency assignment** | ✅ working | 12 Sep | **187 of 194 requirements carry a regulator**, from a reviewable mapping table (`supabase/seed-data/agency-mapping.json`), identical in both environments. **The 49 Oregon rows citing 29 CFR resolve to Oregon OSHA, not federal OSHA** — the line the whole mapping exists to get right. 7 are deliberately NULL: 3 contractual, 2 genuinely ambiguous, 2 with no enforceable citation. |
| **Coverage table** (`industry_coverage`) | 🟡 degraded | 12 Sep | **56 rows in both environments, all `not_built`, 32 of them with nothing behind them.** The data is right and **nothing renders it** — no reader exists outside the loader, so the coverage strip `CLAUDE.md` §6 describes does not exist. Degraded rather than working because the honest signal is computed and invisible. `row_count` counts live rows only (`AUDIT-CHECKS.md` check 4). |
| **Switch library** (`switches`) | ✅ working | 12 Sep | **90 switches in both environments, 35 dependency edges, 0 cycles, graph walked from each database and compared.** 70 site-scoped, 20 company; 6 numeric carrying their thresholds; 43 non-static, so 43 facts can now expire. Derived from 188 requirement trigger strings rather than from the design document — `DECISIONS.md` §36. |
| **Critic pass** (Stage 5) | ✅ working | 12 Sep | **Live on `/api/chat` checklist mode and `/api/audits`**, on the strongest model tier. A fresh call that sees only the output — never the prompt that produced it. **It never rewrites**: findings are applied in code by severity, so a wrong item is withheld with its reason rather than regenerated (`DECISIONS.md` §39). Verified against the frozen 2.5L artifact in `baseline-outputs/`: 13 findings, 7 blocking, all seven known errors caught plus four nobody had recorded. Negative control held — 0 blocking on a verified-correct answer. Not yet exercised by a person. |
| **Model tier routing** | ✅ working | 12 Sep | `judgement` · `critique` · `prose` · `default`, private to `lib/ai.ts`. **And it surfaced a latent bug**: the Claude 5 family rejects `temperature` outright, six call sites pass it, and `AI_MODEL=claude-sonnet-5` would have 400'd all six. The pipe now drops the parameter where it is not accepted. `AUDIT-CHECKS.md` check 15. |
| **Determination gate** (Stage 1) | ✅ working | 12 Sep | **Live on `/api/chat` and `/api/audits`.** Before any answer it decides what facts the question turns on and asks for one if a blocking fact is missing. Verified against staging by `npm run golden`: the 2.5L bottle case asks for the SDS; the Oregon minimum-wage case proceeds without asking, treating jurisdiction as already known. `substeps` is deliberately not gated. Not yet exercised by a person — `docs/TESTING.md` has the manual set. |
| **`company_switches` / candidates / jobs** | ⬜ not built | 12 Sep | Tables exist in both environments and are **empty with no caller**. `company_switches` fills at runtime from determination, not from a seed — it stays 0 until something determines a fact and writes it. `library_candidates` and `jobs` wait for Phase 4 and Phase 5. Not a gap; ahead of their users on purpose. |
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
