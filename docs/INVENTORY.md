# The Whole Surface — phase-by-phase inventory
**Version:** 1 · **Updated:** 12 September 2026
**What this is:** every phase, module, gate item and recorded finding in one pass, in

> ### 📅 THIS IS A DATED SNAPSHOT, NOT A CURRENT STATE — taken **12 September 2026**.
>
> Every count below was true on that date and several are not now: eleven migrations have
> landed since. **Read it as history.** For current state use `STATUS.md` (one line per
> module with the date it was last actually checked) and the live database.
>
> **It is kept rather than updated** — a dated snapshot is honest history, and the only risk
> is somebody reading it as current, which this block exists to prevent.
`TODO.md`'s own numbering. Read it to see what exists and what does not without opening six
files. **It is a snapshot, not a source of truth** — `TODO.md` stays authoritative for the
*what next*, `DECISIONS.md` for the *why*, `AUDIT-CHECKS.md` for the *is it still true*.

**Every number here was read from the repo or the two databases on 12 September 2026.** None is
carried forward from a session summary (`DECISIONS.md` §46).

> ### ⚠️ NUMBERING: this is `TODO.md`'s, and `BUILD-PLAN.md`'s differs for five phases.
> **There is no Phase 3 and no Phase 8 in this list.** Build-plan Phase 3 is this list's Phase 5
> (the worker); build-plan Phase 8 is this list's Phase 9 (observability). The mapping table is
> at the top of both files. Always say which document a phase number belongs to.

---

## The ground state, measured

| | Staging | Production |
|---|---|---|
| Migration head | **017** | **017** |
| Census objects | **840** | **840** — 0 differences, byte-identical |
| Requirement rows | 205 (200 live) | 205 (200 live) |
| …with `applies_expression` | 199 | 199 |
| …at `status = verified` | **0** | **0** |
| …with a `citation_url` | **0** | **0** |
| Switches · agencies · coverage rows | 95 · 33 · 56 | 95 · 33 · 56 |
| `obligations` | **0** | **0** |
| `company_switches` | 16 *(a test fixture)* | **0** |
| `company_chemicals` · `regulated_substances` | 0 · 0 | 0 · 0 |
| `switch_determinations` · `obligation_evidence` · `jobs` | 0 · 0 · 0 | 0 · 0 · 0 |

**167 tests · 3 golden-file cases · 24 audit checks, all hand-run (there is no `npm run audit`).**

**The one-line reading of that table: two engines work and nothing renders either.** Resolution
decides which requirements apply; determination establishes the facts they turn on. No screen
shows an obligation, and no route writes a switch.

---

## ⛔ THE GATE — before the first real customer document

| | | State |
|---|---|---|
| **Key rotation — SEVEN credentials** | Four from a zip (9 Sep), both database passwords printed to a terminal (10 Sep), and the **production service-role key** printed by a shell check (12 Sep). The seventh bypasses RLS entirely and argues for rotating now rather than at the gate. | ⬜ **the only gate item** |
| ~~Phase 1 schema rebuild~~ | Migrations 006–010, both environments | ✅ closed 11 Sep |
| ~~`memberships`~~ | Withdrawn — the schema already supports colleagues; what is missing is an invite route (M8.1) | ✅ corrected 10 Sep |

**One more thing belongs here and is not yet on the list:** migration 016's behavioural tests
write and delete rows in `obligations` for a real company. That is safe today because all ten
production companies are test rows. **It stops being acceptable the moment a customer exists.**

---

## PHASE 0 — Foundation

| | | State | |
|---|---|---|---|
| **0.1** | Environment and tooling | ✅ 9 Sep | |
| **0.2** | Schema reproducibility — `npm run db:reset` replays 000→017 from empty | ✅ 9 Sep | |
| **0.2b** | Local development points at staging | ✅ 10 Sep | |
| **0.3** | Storage security | ✅ 9 Sep | migration 002 |
| **0.4** 🔒 | Close the remaining service-role holes | ✅ 9 Sep | four named exceptions remain |
| **0.5** | Tenancy consistency | ✅ 10 Sep | migration 003, production |
| **0.6** | Write policies on every table | ✅ 10 Sep | migration 004, production |
| **0.9** | Convert routes off the service-role key | ✅ 10 Sep | ten routes on `requireCompany()` |
| **0.7** | Housekeeping — 2 hours | ⬜ | depends on nothing |
| **0.8** | Follow-ups from the Phase 1 rebuild | ⬜ | depends on nothing |
| **0.8b** 🔒 | **Routes with no session check** | 🔄 **partly done** | see below |

**0.8b, at item level.** The heading says six routes. **Verified on disk 12 Sep:**

| Route | Session check | |
|---|---|---|
| `/api/chat` | ✅ **has one** — gained in 2.2 | closed |
| `/api/industries` · `/api/signup` | none | **documented, deliberate** (§0.9) |
| `/api/extract-dates` · `/api/feedback` · `/api/scan-website` | **none** | ⬜ **the three genuinely open** |

---

## PHASE 1 — Schema rebuild ✅ COMPLETE 11 September

All six items landed; migrations 006–010 on both environments. **The sub-item markers 1.1–1.6
in `TODO.md` still read ⬜ and are stale** — the phase header above them says "all six items".

| | | |
|---|---|---|
| **1.1** 🔒 | Design the corrected schema | ✅ |
| **1.2** | New tables — including `company_switches` | ✅ |
| **1.3** | Rebuild — the chain builds from nothing, and did not before | ✅ |
| **1.4** 🔒 | Match key's **inputs** — jurisdiction columns on `entities` (009) | ✅ *(the rule itself is 4.1, done)* |
| **1.5** | `STATUS.md` | ✅ now at v11 |
| **1.6** 🔒 | Multi-facility structure | ✅ — and **demonstrated working** 12 Sep (`DECISIONS.md` §20) |

---

## PHASE 2 — The runtime pipeline · quality items closed 12 September

| | | State | |
|---|---|---|---|
| **2.1** 🔒 | Agency list — 33 agencies, 193 of 200 live rows assigned | ✅ both environments | migration 011 |
| **2.2** | Determination gate — Stage 1 | ✅ live on `/api/chat` and `/api/audits` | `lib/determinationGate.ts` |
| **2.3** | Critic pass — Stage 5 | ✅ live on both | `lib/criticPass.ts`; 84s average, the most expensive call |
| **2.4** ⚡ | Split identification from expansion — 1 day | ⬜ | depends on nothing |
| **2.5** ⚡ | `lib/ai.ts` | 🔄 **routing done, three items open** | model tiering ✅; `scan-website` still bypasses the pipe |
| **2.6** | Zod at the AI boundary — 2 days | ⬜ | depends on nothing |
| **2.7** | Two error messages — half day | ⬜ | depends on nothing |
| **2.8** | Golden-file set | 🔄 **runner built, 3 cases** | `npm run golden`; cases 001, 002, 003 |

---

## PHASE 4 — Resolution engine

| | | State | |
|---|---|---|---|
| **4.1** | **Resolution function** | ✅ **DONE 12 Sep** | `lib/resolve.ts` + `lib/jurisdiction.ts`. Six-case match key, three-valued, per-site quantification. **`TODO.md`'s heading still says "THE NEXT LARGE PIECE" and is stale** |
| **4.2** | `close_and_replace_obligations` | ✅ **DONE 12 Sep** | migration 016, both environments. Close-and-insert, no DELETE |
| **4.2b** | Revoke EXECUTE on `substance_inventory` from PUBLIC | ⬜ **10 minutes** | nothing. `AUDIT-CHECKS` check 22 |
| **4.3** | Determination chain — 1 day | ⬜ | 4.1 ✅ |
| **4.4** 🔒 | First tests in the codebase — 2 days | 🔄 **substantially overtaken** | **167 tests exist**, plus `npm run mutation` (nine breakages, all caught) and `npm run test`'s shrink guard. What remains is coverage this item named that is now mostly written |

---

## PHASE 5 — The worker *(= build plan's Phase 3)*

| | | State | Depends on |
|---|---|---|---|
| **5.1** | Worker skeleton — 3 days | ⬜ | nothing. `jobs` table exists, 0 rows |
| **5.2** | First job: `index_document` — 3 days | ⬜ | 5.1 |
| **5.3** | Deployment — 1 day | ⬜ | 5.1, 5.2 |

---

## PHASE 6 — Library: chemical Oregon

| | | State | |
|---|---|---|---|
| **6.1** | Migrate the rows | ✅ in Phase 1 | |
| **6.2** | Load the switches — 95, 40 edges, acyclic | ✅ both environments | migration 012 |
| **6.3** | `applies_expression` — **199 of 200 live rows** | ✅ both environments | migrations 013, 014 |
| **6.3a** | The per-substance threshold shape | ✅ **answered** — thresholds live on `regulated_substances`, keyed by CAS | |
| **6.3b** | `is_determination` wrong on three rows | ⬜ | **9 of 200 flagged; `produces_switch` NULL on all 200** — the wiring is unstarted library-wide |
| **6.4a** | The six low-confidence conditions | ⬜ | **NSPS/NESHAP under-triggers — the only one failing the dangerous way.** 4 of 6 are one missing input: NAICS |
| **6.4b** | **Seed `regulated_substances`** | ⬜ | nothing. **0 rows. Unblocks 15 requirements for EVERY customer at once** |
| **6.4c** | The one deliberate NULL (`Employee handbook`) | ⬜ | a decision: does a best-practice row belong in a legal library |
| **6.4d** | The 12 switches no condition references | ⬜ | 4 are context and correct; 8 close with 6.4b / 6.3b / data |
| **6.4e** | The 18 medium-confidence conditions | ⬜ | **three shapes, not eighteen problems** |
| **6.4f** ⛔ | **Recount `industry_coverage.row_count`** | ⬜ **A LIVE DEFECT ON PRODUCTION** | nothing. OR-OSHA reads **53** where the live count is **61** — customer-visible understatement |
| **6.4g** | Two rows wrongly `entity_type = 'site'` | ⬜ | `USDOT number`, `PHMSA annual registration` — both issued to a legal entity, not a facility |
| **6.5** | Federal layer, agency by agency — 1 week | ⬜ | 6.7, to be trustworthy |
| **6.6** | Oregon layer, agency by agency — 1 week | ⬜ | 6.7 |
| **6.6a** | Six Oregon agencies with ZERO requirements behind them | ⬜ | 6.6 |
| **6.6b** | Two rows needing a decision, not a generation pass | ⬜ | a decision |
| **6.7** | Primary-source retrieval — 4 days | ⬜ | **nothing. 0 of 200 rows carry a `citation_url`** |
| **6.8** | Human verification by fact class — 4 days | ⬜ | 6.7, and **a person** — only the owner sets `verified`. 0 of 200 today |
| **6.9** | Standing "confirm before publishing" list | ⬜ ongoing | |

---

## PHASE 6b — Employment law library (OR & WA) ⬜ not started

The second vertical's library. Depends on 6.5–6.8's method being proven on the first.

---

## PHASE 7 — Switches and evidence

| | | State | |
|---|---|---|---|
| **7.1** | Public-records lookups — 4 days | ⬜ | nothing. RCRAInfo, ECHO, TRI, SAFER, OLCC |
| **7.2** | **Switch determination from documents** | 🔄 **schema + logic done, NO ROUTE** | see below |
| **7.2a** | **The routes — 1 day** | ⬜ | **nothing. Everything under it is built and tested** |
| **7.2b** | Golden document cases | ⬜ **BLOCKED** | **a decision**: may customer-uploaded files enter the repo? |
| **7.2c** 🔒 | A trigger for `user_locked` — half day | ⬜ | nothing. `AUDIT-CHECKS` check 24 |
| **7.2d** | Coverage — **42 of 95 switches (44.2%) have no determination path** | ⬜ | 29 need an ask path, 11 need signup, 2 need 6.3b |
| **7.3** ⚡ | Normalise audit output into `obligation_evidence` — 4 days | ⬜ | **0 rows today. M6's numbers depend on this** |
| **7.4** | Evidence expiry in code — half day | ⬜ | 7.3 |

**7.2, at item level — what is done and what is not.**

| Done | Not done |
|---|---|
| Migration 017 — `evidence_class`, `switch_determinations`, `company_switches.determined_from`, composite FK pinning the class | Any route reading or writing either table *(verified: the four files naming them are comments or the deletion list)* |
| `prompts/switch-determination.ts` — seven forbidden inferences, exported for assertion | Any AI call ever made with it |
| `lib/switchDetermination.ts` — precedence ladder, §49 overwrite history, 31 tests | The ask-path UI |
| `lib/sdsExtraction.ts` — §48 CAS check digit, 14 tests | `tests/golden-documents/` — does not exist |

**The measured result:** three SDSs moved **zero** obligations. An SDS states identity, never
inventory. One confirmation moved 9; one question moved 19.

---

## PHASE 9 — Observability ⬜ · PHASE 10 — Cannabis Oregon ⬜ · PHASE 11+ ⬜

*(Phase 9 = build plan's Phase 8.)* Phase 10 depends on the chemical vertical's method; all 25
cannabis coverage rows are at zero.

---

## MODULES — the seven product surfaces, built last

| | | State | Depends on |
|---|---|---|---|
| **M1** | **Compliance Workspace** | ⬜ | 2.2 ✅ · 2.3 ✅ · `company_switches` ✅ · Phase 4 ✅(4.1, 4.2). **Three and a half of four met.** Spec is `WORKSPACE.md` **v2**, written — nothing blocks it on a document |
| M1.0 | `/api/chat` never enables web search | ⬜ | 2.5 |
| M1.0b | `topics` — deliberately not built | ⬜ | a decision |
| M1.1–M1.6 | Follow-up classification · fact capture · scoped questions · topic lifecycle · in-context facts · answer display | ⬜ | M1 |
| **M2** | **Audits** | 🔄 **degraded and live** | **Silently drops documents it cannot read** — `satisfied=2` computed from 1 of 8. Also a **3.5× consistency spread** (6–21 on the same 272-item standard) |
| **M3** | **HR** | 🔄 degraded and live | `.docx` now reaches the model; requirements are eleven hardcoded words with no jurisdiction |
| **M4** | **Documents** | ✅ working | Debts: review runs twice per document; nothing records supersession |
| **M5** | **Calendar** | ✅ working | Debt: dates extracted from documents rather than read from obligation cadence |
| **M6** | **Dashboard** | ⬜ | **numbers** need 7.3 + 6.7. **The requirements list itself needs only Phase 4, which is done** |
| M6.1 | Verification section | ⬜ | 6.7, 6.8 |
| **M7** | **Onboarding and signup** | 🔄 degraded and live | Does not capture `county`; **never asks `employee_count`** |
| **M8** | **Account** | 🔄 working, incomplete | |
| M8.1 | Invite, list, remove | ⬜ | nothing structural — the schema already supports colleagues |

---

## Findings that were recorded and never became tasks

**These are the ones this document exists for.** Each is in `AUDIT-CHECKS.md` or `TESTING.md` as
a check or a note, and none appears in a numbered phase.

| | Finding | Where | Shape |
|---|---|---|---|
| ⛔ | **Check 12 is FAILING** — coverage `row_count` 53 vs 61 | check 12 | now **6.4f** |
| 🔒 | **`user_locked` has zero policies, constraints or triggers** | check 24 | now **7.2c** |
| 🔒 | `substance_inventory` holds EXECUTE for PUBLIC | check 22 | now **4.2b** |
| 🟡 | **0 of 200 rows carry a primary source or are verified** | check 1 — *"the worst answer in this file"* | 6.7, 6.8 |
| 🟡 | Check 20 passes **vacuously** — both chemical tables empty | check 20 | closes with 6.4b |
| 🟡 | **Confidence never reaches the database.** 175 high / 18 medium / 6 low live only in the seed file; the loader writes `applies_expression` alone | `SWITCH-DETERMINATION.md` §9 | **no task exists.** `CLAUDE.md` §6 says a verified row and a generated row must not look the same — today they are identical |
| 🟡 | **The coverage strip does not exist.** 56 rows, all `not_built`, nothing renders them | `TESTING.md`, M6 | M6 |
| 🟡 | **A profile is indistinguishable from a default.** A company that answers nothing resolves to 2 `applies`, correct and identical for every Oregon employer | M6 requirement, added 12 Sep | M6 |
| 🟡 | `companies.scan_result` is a parallel, weaker store of switch facts — no basis, no confidence, no expiry, and it disagrees with a stated address | `TODO.md` M4 note, §24.1 | M7. **Re-derive, never migrate** |
| 🟡 | **24 checks are all hand-run.** There is no `npm run audit` | `AUDIT-CHECKS.md` | deliberate until after Phase 2; now overdue |
| 🟡 | Migration 016's tests write to `obligations` for a real company | this file, gate | belongs on the gate |

---

## Documentation staleness found while writing this

`TODO.md` carries four markers that would mislead someone reading it cold:

1. **`### 4.1 … ⬅️ THE NEXT LARGE PIECE`** — 4.1 is done; the heading contradicts its own body.
2. **`1.1`–`1.6` all marked ⬜** under a phase header reading *"complete — all six items"*.
3. **`"012 is the latest as of 12 September"`** — it is **017**.
4. **`## Next three sessions`** — sessions A, B and C are all complete (10, 11 and 12 Sep).

---

## The next three, by dependency

**Build 7.2a's routes, then M7's three onboarding questions, then a one-day defect batch** —
and the reasoning is that this project now has two working engines and no surface, so the
binding constraint is visibility rather than capability. **7.2a is one day, depends on nothing
unbuilt, and is the shortest path to the first moment in this project's history when a person
changes a value and watches their requirement list move**; everything beneath it is already
tested, and without it the ask path cannot be exercised by anybody outside a test script.
**M7's three questions come second because the measurement is unambiguous and uncomfortable**:
`has_employees`, `employee_count` and `site_employee_count` gate 53 requirements, depend on
nothing, and are form fields rather than documents — one of them moved 19 obligations where
three safety data sheets moved zero, so they outrank most of Phase 7 on value per day while
sitting in MODULES behind three phases they do not need, which is the same misplacement that
pulled 6.2 and 6.3 ahead of 4.1. **Third is a defect batch — 6.4f, 7.2c, 4.2b and 0.8b's three
routes — because 6.4f is a live production defect understating OR-OSHA coverage to any customer
who sees it, and the other three each close a recorded security or correctness finding in under
a day.** What I would *not* do next is 4.3, 4.4, 5.x, 7.1, 7.3 or 6.5/6.6: every one adds
capability to a layer that already works and that nothing renders, and `DECISIONS.md` §18's
horizontal-first ordering was written when the ground was still moving — it has stopped.
