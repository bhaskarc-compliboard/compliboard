# STATUS

**Version:** 2 · **Updated:** 11 September 2026
**Supersedes:** version 1 (11 Sep) — which said production was on 009 when it was on 007.
**Environment:** **staging and production both on 000–010**

> ✅ **The two environments are the same shape again.** Compared object for object —
> columns, indexes, policies, constraints, enum values, functions, triggers, grants and
> storage policies — **673 objects each, zero differences, in either direction.** Verified
> after 008, 009 and 010 landed in production on 11 Sep.
>
> This file previously said production was on 009 when it was on 007. That was written from
> recollection rather than from the database and was caught by a pre-flight. Every count in
> this file is now read from the database.

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
| **Requirements screen** (`/requirements`) | 🔧 not-yet-rebuilt | 11 Sep | Migration 007 dropped the 376 obligations — derived output, and they carried the jurisdiction defect. Nothing regenerates them until the resolution engine exists (**Phase 4.1**). `/api/obligations` returns `[]` with a 200 and the page renders empty. **Expected. Not a regression.** |
| **Audits** (`/audits`) | 🟡 degraded | 10 Sep | **Silently drops documents it cannot read.** Observed in a real run: `satisfied=2 needs_info=1` computed from **one readable document out of eight**, the other seven dropped by `if (dlError \|\| !fileData) continue` with no error and no record. Plausible numbers, wrong basis — `TODO.md` M2(a). Also `matched_documents` can contain an entry with a null `document_id`. |
| **HR** (`/hr`) | 🟡 degraded | 10 Sep, by reading the code — **not run** | Audit reads **one** handbook; ask reads all. Requirements are eleven hardcoded words in a prompt with no jurisdiction and no thresholds, so a handbook can pass "FMLA present" and miss both Oregon obligations. `draft_policies` ships suggested legal language unconditionally. `TODO.md` M3. |
| **Documents** (`/documents`) | ✅ working | 10 Sep | All four methods converted to the caller's token and verified by per-table row-count comparison against the service role. Debts, not breakage: review runs inline and twice per document; nothing records what a document supersedes (`TODO.md` M4). |
| **Calendar** (`/calendar`) | ✅ working | 10 Sep | Converted and verified the same way. Debt: dates are extracted from documents rather than read from obligation cadence, so the calendar lists dates somebody's paperwork mentioned rather than deadlines that bind (`TODO.md` M5). |
| **Dashboard** (`/dashboard`) | ❓ unknown | — | **Not exercised this session.** Reads calendar, document reviews and checklists — **not** obligations — so the empty obligations table does not affect it. That is from reading the page, not from running it. |
| **Compliance workspace** (`/compliance`) | ❓ unknown | — | Not exercised this session. The 1,282-line page that predates the Workspace design in `WORKSPACE.md`; that design is M1 and unbuilt. |
| **Signup** (`/signup`) | 🟡 degraded | 11 Sep | **Was ⛔ broken in production for roughly two hours today** — migration 007 renamed `industry` → `industries[]` and `/api/industries`, the only caller, kept selecting the old name, so the dropdown came back empty and blocked signup. **Fixed and verified 11 Sep.** Still degraded: does not capture `county`, and `employee_count` is never asked for (writes NULL). |
| **Upload** (`/upload`) | 🟡 degraded | 9 Sep | `app/upload/page.tsx:89` calls `getPublicUrl` on a private bucket. Already broken before this work; `TODO.md` §0.7. |

## Infrastructure

| Piece | State | Verified | Notes |
|---|---|---|---|
| **Tenancy / RLS** | ✅ working | 11 Sep | **65 policies across 23 tables, 59 of them through `auth_company_id()`** (read from the database, not recalled). `anon` holds zero grants anywhere. Verified by comparing row counts under a caller's token against the service role, not by HTTP status. |
| **Storage scoping** | ✅ working | 10 Sep | Six tests with real sessions: a company can read and write only its own prefix. Before migration 002 every authenticated user could read and delete all 52 files across 7 companies. |
| **Migration chain** | ✅ working | 11 Sep | 000→010 applied to an **empty** database and compared object-for-object against production: **673 objects each, 0 differences.** `npm run db:reset` does this; running it the first time found two migrations that had never been able to build from nothing. |
| **Requirement library** | ✅ working | 11 Sep | 194 rows in production and staging — 192 active, 2 retired parents, 6 split children with resolved lineage. Every row categorised. |
| **Switches / coverage / candidates / jobs** | ⬜ not built | 11 Sep | Tables exist **in both environments** (migration 008) and are **empty with no caller**. `switches` fills at 6.2; the rest at Phase 4 and later. Not a gap — they are ahead of their users on purpose. |
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
- **Key rotation outstanding.** Six credentials. Item 1 of the gate, and the only gate item
  still open.

## How to keep this honest

Update it when a module's state changes, **and when a rebuild makes something stop
working on purpose** — that second case is the whole reason it exists. A line saying
"verified 10 Sep" a month later is not a claim that it works; it is a claim that nobody
has looked since.
