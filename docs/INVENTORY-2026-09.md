# INVENTORY — every file in the repo against what is true on 28 September 2026

**Written 28 September 2026, and updated the same day with the owner's decisions on Part 3.** One row
per file: what it is for, whether it is current, and what was done.

**After the cleanup the repo holds 34 API routes and 14 pages** (was 35 and 15). Four things were
deleted on the owner's decision — `app/upload/page.tsx`, `app/api/document-review/route.ts`,
`baseline-outputs/` and `CURRENT-SCHEMA.md` — and **git history keeps every one of them.** Two things
were kept with a note rather than removed, and one was kept and secured.

**Truth this was checked against.** Production is at migration **054** and the commit pushed on
26 September. Documents rev 1 is released. Production reads documents on **`claude-opus-5-5`** with
**`AI_SCAN_STRUCTURED = false`**. `docs/RELEASE.md`'s variable list is authoritative for Vercel.
`DECISIONS.md` §131–§138 record Documents. The vision is `docs/VISION-DOCUMENTS.md`. The bake-off is
`tests/golden/documents/bakeoff/2026-09-27-rejudged.md`.

---

## ⚠ TWO FACTS IN THE BRIEF THAT THE REPO DOES NOT MATCH

Recorded here rather than worked around, because both change what a later reader should trust.

**1. `docs/HANDOFF-AUDITS.md` did not exist — ✅ RESOLVED 28 September 2026.** When this inventory was
written the file was not on disk and the pointer was dangling. **The owner added it on 27 September**
and it is now the brief for the section after Documents: §5 is the design template every section
follows, §6 the file structure, §4 what Documents provides to Audits. Both completed handoffs and
`docs/README.md` now point at it as well as at `DESIGN.md`. *Left in place rather than deleted because
it is why the pointers read the way they do.*

**2. `DECISIONS.md` §138 was already taken.** It is *"READ IT AGAIN RAN IN THE DRAWER'S REQUEST"*,
written on 28 September for the drawer fix. The brief asks for §138 to record the bake-off and the
production switch to `claude-opus-5-5`; that has been appended as **§139**, because `DECISIONS.md` is
append-only and renumbering an existing entry would break every cross-reference to it.

---

## Part 1 — the inventory

### Root

| Path | What it is for | State | Done / proposed |
|---|---|---|---|
| `CLAUDE.md` | The standing brief Claude Code reads every session | **Current** | **Corrected.** §3.4a's production-model paragraph, plus the three new rules from this week (staging reset under a pty, read-only production queries, prove a check can see a presence) |
| `AGENTS.md` | "This is not the Next.js you know" — read the bundled docs first | Current | None needed |
| `README.md` | The stock `create-next-app` readme. Says nothing about CompliBoard | **Outdated in substance** | **Left.** Propose replacing with four lines naming the product, the stack and where the docs are. Not done: it is not a factual error, it is an absence, and the owner may want it to stay anonymous |
| `STATUS.md` | One line per module with the date it was last actually checked | **Outdated** | **Corrected.** Said both databases are on 000–039 and `PENDING COUNT: 0`; production is on 054. Documents rows added as done |
| `CURRENT-SCHEMA.md` | A production schema capture from **9 September** | **Superseded** | **Note added at the top** pointing at `docs/SCHEMA.md`, which is generated and 26 tables newer. Propose delete; `git log` keeps it |

### docs/ — current and load-bearing

| Path | What it is for | State | Done / proposed |
|---|---|---|---|
| `docs/README.md` | What each doc covers | **Outdated** | **Corrected** — did not list `VISION-DOCUMENTS.md`, `RELEASE.md`, `DESIGN.md` or this file |
| `docs/DECISIONS.md` | Every decision and why, append-only | Current | **§139 appended** (bake-off + the production switch). Nothing above it touched |
| `docs/HOW-WE-BUILD.md` | The working method, the three roles, the loop | Current | **Corrected** — the three new rules added to §3 and §5a |
| `docs/RELEASE.md` | How a change reaches production; **authoritative for Vercel's variables** | Current | **Corrected** — `AI_MODEL_DOCUMENT_SCAN = claude-opus-5-5`, `AI_SCAN_STRUCTURED = false`, as of 27 September |
| `docs/SCHEMA.md` | Generated schema reference | Current | **Regenerated**, not edited |
| `docs/TESTING.md` | The three kinds of test and every manual set | Current | **Historical markers added** to the sets that test the removed Review button and the old date-extraction on the Documents page |
| `docs/VISION-DOCUMENTS.md` | The Documents module's vision (27 Sep) | **Current — this is the one** | None needed |
| `docs/DESIGN.md` | The layout template | Current | **Checked rule by rule against the shipped page — see the table below.** Changed nothing: the layout chat owns it |
| `docs/archive/AUDIT-CHECKS.md` | The questions `npm run check` does not answer | Current in shape, answers are dated | **Note added**: no check has been re-run since 22 September, and Documents added five tables none of them cover |
| `docs/TODO.md` | Task-level to-do | **Outdated** | **Corrected.** Documents marked done with pointers; the M4 plan superseded-noted |
| `docs/archive/BUILD-PLAN.md` | The phased plan and why the order is the order | **Outdated** | **Superseded note** on the Documents/M4 part; the phase ordering itself is unchanged and still right |
| `docs/releases/2026-09-26-documents-rev1.md` | The rev 1 release note, with its smoke test outcomes | Current | None — it is a dated record and is finished |

### docs/ — design specs, written before the thing was built

These are the module designs. Each is still the reference for its own module; none has been rewritten
to match what shipped, and that is the normal state for a spec.

| Path | What it is for | State | Done / proposed |
|---|---|---|---|
| `docs/WORKSPACE.md` | The Compliance Workspace: conversations, facts, topics, signup | Current as a design; the workspace shipped | **Note added**: the attach path is `/api/document-scan` since Run 6, not the review route |
| `docs/archive/CHEMICAL-OR-WA.md` | The first vertical's full design | Current as a design, **not built** | None needed; `CLAUDE.md` §1 already corrects its switch count |
| `docs/DETERMINATION-GATE.md` | Stage 1 of the runtime pipeline | Built except §11 | None needed |
| `docs/CRITIC-PASS.md` | Stage 5, the reviewer | Built 12 Sep | None needed |
| `docs/RESEARCH-ANSWER.md` | The research answer's shape | Built | None needed |
| `docs/archive/GATE-HISTORY.md` | M1.2b, the gate gains a conversation | Built | None needed |
| `docs/SWITCH-DETERMINATION.md` | Phase 7.2 | Built | None needed |
| `docs/EVIDENCE-LINKING.md` | Phase 7.3 | **Design only, not built** | None needed |
| `docs/archive/REQUIREMENTS-SCREEN.md` | M6, the requirements screen | **Design only, not built** | None needed |
| `docs/PATTERNS.md` | Conventions carried over from Bizpulses | Reference, ages fine | None needed |
| `docs/archive/INVENTORY.md` | A phase-by-phase surface inventory from **15 September** | **Superseded by this file** | **Note added at the top** pointing here. Propose keep: it is organised by phase, this one by file, and they answer different questions |
| ~~`docs/Vision for Document Module.pdf`~~ | The vision as a PDF export | Superseded by the `.md` | ✅ **DELETED 28 Sep**, owner's decision, overriding this file's proposal to keep it. **`VISION-DOCUMENTS.md` is the source, not a rendering of the PDF**, so the PDF was the derived copy and the one that could go stale. Git history keeps it |

### docs/ — completed handoffs

| Path | What it is for | State | Done / proposed |
|---|---|---|---|
| `docs/archive/HANDOFF-DOCUMENTS.md` | Brief for the chat that built Documents | **Completed 26 September** | **Marked completed at the top**, dated, pointing at `VISION-DOCUMENTS.md` and `DESIGN.md` §6. Not deleted |
| `docs/archive/HANDOFF-LAYOUT.md` | Brief for the layout pass on the workspace page | **Completed 24 September** | **Marked completed at the top**, same pointers. Not deleted |
| `docs/HANDOFF-CODE.md` | The state of the code — **the file the next chat trusts** | **Badly outdated**: §2 was headed "039 ON BOTH" | **Rewritten** state sections to 28 September, structure kept |

### prototypes/, baseline-outputs/, components/archive/

| Path | What it is for | State | Done / proposed |
|---|---|---|---|
| `prototypes/compliance-workspace.html` | The design reference the workspace was built from | **Spent** — the page it describes shipped and then changed in the layout pass | **Listed, kept.** Propose **archive**: `DESIGN.md` is the live template now and two references invite drift |
| `prototypes/README.md` | Says what the prototype is for | Current | None |
| `baseline-outputs/*.json` (13 files) | Production row dumps from **9 September**, the before-picture for the pipeline work | **Spent** | **Listed, kept.** Propose **delete**: `git log` holds them and `document_reviews.json` now describes a table with 0 rows on staging |
| `components/archive/GateAskCard.tsx` | A gate card the workspace replaced | **Dead — no caller** | **Listed, kept.** Its own README says why it is kept. Propose keep |

### scripts/ — named by an npm command

`check-live`, `check-prompt-determinism`, `check-schema-contracts`, `cost-report`, `db-migrate`,
`db-restore`, `db-types`, `golden-facts`, `load-expressions`, `mutation-check`, `preflight-prod`,
`probe-search-count`, `probe-structured-output`, `render-golden-docs`, `reparse-golden-runs`,
`run-golden-docs`, `run-golden`, `scan-document`, `schema-doc`, `test-guard`, `audit-data-checks`.

**All current.** Two were changed this week and are in the Documents story: `run-golden-docs.js`
(gained `--model`, `--structured`, `--since` and the verdict write-back) and
`probe-structured-output.js` (sends the real `SCAN_JSON_SCHEMA`, takes `--model`).

### scripts/ — named by NO npm command

| Path | What it is for | State | Done / proposed |
|---|---|---|---|
| `scripts/bakeoff-report.js` | Generates the bake-off report from the stored runs | **Current, used 27 Sep** | Propose **keep and add an npm script**; a report whose generator has no command is one nobody re-runs |
| `scripts/load-requirements.js` · `load-switches.js` · `load-agencies.js` · `assign-agencies.js` | Loaded the library, the 95 switches and the agencies | **Current, run once each** | Propose **keep**: they are how the reference data got in, and the next vertical runs them again |
| `scripts/export-requirements.js` | Exports the requirement library for review | Current | Propose keep |
| `scripts/resolve-dryrun.js` | Runs the resolution engine without writing | Current | Propose keep |
| `scripts/seed-staging-testdata.js` · `seed-multisite-fixture.js` | Put test companies on staging | Current | Propose keep |

### app/api/ — every route, and who calls it

| Route | Called by | State |
|---|---|---|
| `documents/` | `/documents`, `/upload`, `check-live` | Current |
| `documents/index/` | `/documents` page | Current |
| `documents/report/` | the report drawer | Current |
| `document-scan/` | `/documents` upload loop, `/compliance` attach, `check-live` | Current — the **live** path |
| `document-rescan/` | the report drawer's "Read it again" | **New 28 Sep** |
| `document-actions/` | the report drawer | Current |
| `document-batches/` | `/documents` upload | Current |
| `document-checklist/` · `document-draft/` | the report drawer | Current |
| `jobs/scan-documents/` | Vercel Cron `*/5`, and `after()` from `document-batches` and `document-rescan` | Current |
| `jobs/summarise/` · `jobs/delete/` | Vercel Cron 03:00 / 03:30 | Current |
| `chat/` | `/compliance`, `/upload` | Current |
| `topics/[id]/` · `topics/[id]/summarise/` | `/compliance` | Current |
| `checklists/from-topic/` · `substeps/` | `/compliance` | Current |
| `to-confirm/` | `/to-confirm` | Current |
| `switches/ask/` · `switches/answer/` | `/compliance` | Current |
| `obligations/` · `audits/` · `hr/` · `hr-audits/` · `calendar/` | their pages | Current |
| `folders/` | `/documents` | Current |
| `link-research/` | the report drawer | Current |
| `account/` · `account/export/` | `/account` | Current |
| `signup/` · `industries/` · `feedback/` | signup, feedback | Current |
| `scan-website/` | signup scan | Current — **still calls Anthropic by `fetch` directly**, the known §3.4 exception |
| ~~`document-review/`~~ | — | ✅ **DELETED 28 Sep.** The dashboard reads `document_index_v` instead |
| `extract-dates/` | `/calendar` page | Current. **Secured 28 Sep** — `requireCompany` added, ledger row carries the company. *The feature is the Calendar section's to keep or remove* |

---

## Part 3 — what has no caller, with the evidence

**Nothing was deleted.** Three of the items the brief listed as suspected-dead are **alive**, and the
evidence is below. `grep -rn` over `app lib components scripts tests`, and `git grep` against the
deployed tree where it matters.

| Item | Evidence | Verdict | Proposal |
|---|---|---|---|
| `lib/documentReview.ts` | **ALIVE.** `app/api/audits/route.ts:3` imports `reviewDocument`, and calls it at `:363` in the audit engine's auto-index step. Also imported by `app/api/document-review/route.ts:33` | **Not dead** | **Keep.** It stops being reachable when Audits is rewired (M2), not before |
| `app/api/document-review/route.ts` | The only caller was `app/dashboard/page.tsx:48` — a **GET**, serving a list computed from `document_reviews`, which holds **0 rows** | Both methods now unreferenced | ✅ **DELETED ENTIRELY 28 Sep**, owner's decision, after the dashboard was rewired to `document_index_v`. `grep -rn "document-review"` over `app lib components scripts tests` returns **only comments**. `lib/documentReview.ts` survives with one caller |
| `app/api/extract-dates/route.ts` | **ALIVE.** `app/calendar/page.tsx` posts to it. Documents orphaned it on that page only | Not dead | ✅ **KEPT AND SECURED 28 Sep.** It had **no session guard at all** — an unauthenticated POST could have a file read by a paid model call, recorded against no tenant. `requireCompany` added, ledger row carries the company. **The feature itself — importing dates from a file rather than reading them off obligation cadence — is the Calendar section's to keep or remove**, and is not decided here |
| `app/upload/page.tsx` | **ORPHAN.** `grep -rn "/upload"` over `app components` returned **no link, no nav item, no redirect** — reachable only by typing the URL | Unreachable in the UI | ✅ **DELETED 28 Sep**, owner's decision. Two upload paths is how the product starts disagreeing with itself. Git history keeps it, and its two open `TODO.md` items are closed by the deletion |
| `components/archive/GateAskCard.tsx` | No importer outside `components/archive/` | Dead by design | **Keep.** The folder's README states the reason |
| `prototypes/compliance-workspace.html` | Referenced by `prototypes/README.md` and by `DESIGN.md` | Spent | ✅ **KEPT 28 Sep**, owner's decision, with a 🕓 HISTORICAL line at the top of `prototypes/README.md` naming `DESIGN.md` as the live template |
| `baseline-outputs/*.json` (13 files + README) | No code read them; a 9 September capture | Spent | ✅ **DELETED 28 Sep**, owner's decision. `docs/archive/AUDIT-CHECKS.md` and `tests/golden/README.md` referenced them and now carry a note that the rows are in git history |
| `CURRENT-SCHEMA.md` | Superseded by generated `docs/SCHEMA.md` | Spent | ✅ **DELETED 28 Sep**, owner's decision. Two `TODO.md` lines referenced it; one of those recorded that it was *wrong* about the reference-table count |
| Scripts with no npm command | Listed above | All still useful | **Keep all**; give `bakeoff-report.js` a command |

> ### ✅ THE ONE RISK IN THIS TABLE IS CLOSED — 28 September 2026.
>
> `document_reviews` has **0 rows**, and the dashboard was still reading the route that served it. So
> "Files reviewed" and "Issues identified" both showed **0** on a company with ten documents and 88
> open gaps — not a blank, a *confident zero*, which is the omniscient-status-tracker anti-pattern
> `CLAUDE.md` §6 names.
>
> **The dashboard now reads `document_index_v`** — one row per document joined to its current scan, the
> same view the Documents page groups and the drawer opens, so the two surfaces cannot say different
> words about the same document (the word map is one file now, `lib/documentStatus.ts`). It shows the
> **five most recent readings** with title, kind, status word and read date, each linking to
> `/documents`; the counts are over every reading, not over the five. The empty state says **"No
> documents read yet"** with a link to **Add files** — and it says *readings*, not *documents*, because
> files may be queued and this list is about readings (§5.1: an empty state is a claim, and it has to
> be true).

---

## `DESIGN.md` against the shipped Documents page — checked, changed nothing

The layout chat owns `DESIGN.md`. This is what differs, and which I think is right.

| `DESIGN.md` says | The shipped page does | Which is right |
|---|---|---|
| §3: a reading surface is **775** wide | The drawer is 775 | **Agree** |
| §3: a table surface is **900** | `/documents` is 900, and its own comment says so | **Agree** |
| §4: one primary or outlined action, everything else a text action | The drawer's footer has exactly one outlined button ("Make a checklist for all N gaps") and the rest are text | **Agree** |
| §4: row titles 13px regular | `/documents` rows are 13px regular | **Agree** |
| §1: no emoji in the shell | None on either surface | **Agree** |
| §2: amber means "this asks something of you" | **Was broken until 28 Sep** — a queued row showed "Reading…" in amber. Now grey while work is in flight | **`DESIGN.md` is right and the page has been brought to it** |
| §7 "Known open, not layout" | Does not mention the Documents page at all | **`DESIGN.md` is behind.** It was written before the page existed. Propose the layout chat adds the Documents table and the report drawer to §4 |

---

## Corrections made, in full

1. `CLAUDE.md` §3.4a — production's model, and the three new rules.
2. `CLAUDE.md` §3.7 — Claude Code may reset staging under a pty; the production guard is never automated.
3. `HOW-WE-BUILD.md` §3 and §5a — the same three rules where the method lives.
4. `STATUS.md` — migration state 039 → 054; Documents rows added as done.
5. `docs/TODO.md` — Documents marked done; the M4 plan superseded-noted.
6. `docs/archive/BUILD-PLAN.md` — superseded note on the Documents part.
7. `docs/RELEASE.md` — `AI_MODEL_DOCUMENT_SCAN = claude-opus-5-5`, `AI_SCAN_STRUCTURED = false`.
8. `docs/HANDOFF-CODE.md` — state sections rewritten to 28 September.
9. `docs/archive/HANDOFF-DOCUMENTS.md`, `docs/archive/HANDOFF-LAYOUT.md` — marked completed with pointers.
10. `docs/README.md` — the four missing files listed.
11. `docs/WORKSPACE.md` — the attach path note.
12. `docs/archive/AUDIT-CHECKS.md` — a note that no check has been re-run since 22 September.
13. `docs/archive/INVENTORY.md`, `CURRENT-SCHEMA.md` — superseded notes pointing at what is current.
14. `docs/TESTING.md` — historical markers on the removed-screen sets.
15. `docs/SCHEMA.md` — regenerated.
16. `docs/DECISIONS.md` — §139 appended.
