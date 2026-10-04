# The Compliance Workspace — what's left

**Version:** 2 · **Updated:** 4 October 2026 — Stage 4's first item built (Part 2) and the rebuild-from-empty rehearsal done. Version 1 was written after the Workspace Task 6 release.

> **The owner's working copy is a Claude Doc, "Compliance Workspace — the map of what's left".
> This file mirrors it**, so the next session can read the plan from the repository. When the two
> disagree, the owner's doc wins and this file is corrected.

The plan has five stages, in this order. **The next session starts at Stage 3.** *(Stage 2 done 4 October 2026.)*

---

## Stage 1 — The Task 6 release · DONE, 4 October 2026

Migration 064 is on production, the code is pushed (`a701436`), and the new settings are on Vercel.
The owner's live checks passed. `DECISIONS.md` §158.

## Stage 2 — The polish pass · DONE, 4 October 2026 (`04f81c6`, `94f630b`)

Built as below, plus one fix the print check found: the site header no longer prints over a drawer
(`components/AppLayout.tsx`). `DECISIONS.md` §159. **And the print frame** (board 10, `94f630b`,
`DECISIONS.md` §160): the four drawers and the printed conversation carry the company, the document
type, "Prepared with CompliBoard" and "Page n of N" on every page, with the browser's own header and
footer off. **The app-wide print sweep waits** until every section has its new look. The owner's live checks: `docs/TESTING.md`,
"Workspace Stage 2".

1. **The summary drawer as an accordion.** The canvas "CompliBoard Compliance Workspace — the feature
   boards", board 6b:
   - each authority is folded, with "N things to do";
   - "Still to confirm" is never folded;
   - an "Open all" control;
   - the print is always fully open.
2. **One-line source links:** "[n] host · title", cut with "…", the full title on hover.

The print check is **DONE** (4 October): a checklist with "How do I do this?" steps printed correctly.

## Stage 3 — The quality pass

**How it is run.** Each change is measured against the baseline, one at a time. The fixed cases are
the ethanol conversation plus two or three other industries. Each run is judged on:
- missing final-state obligations;
- items stated more firmly than their evidence;
- the share of claims that come from the agency's own pages;
- searches, tokens and cost per call.

**The changes, in order:**
1. A baseline run on Opus 5.5.
2. Mothership-first search: the agency's own domains first, then an open search with copy sites blocked.
3. Read the item's already-cited page before searching.
4. Check the search tool version. Newer versions filter results before reading them.
5. Effort, after change 2.
6. A consistency check for items that depend on something under "To confirm".
7. A quote check for "How do I do this?".
8. Research answers that cite at the source.
9. A cheap model fetches and trims; Opus writes.
10. Tune the search limits.
11. "Everything on this subject" re-adding discussed points.
12. A coverage check — only if omissions come back.

**Held for the final-model run.** The owner's decision (`DECISIONS.md` §158): small fixes found while
testing wait until every feature runs on its final models and settings. Then each is tested again,
and dropped if it is no longer needed.
- Old checklists that claim an order.
- Research that contradicts its own item (MNBP registration: 27 CFR 17.21).
- Section-level citations.
- A numbers check (the "$5,400 per 55-gallon drum" that should be about $1,426).
- Steps that belong to other items.
- The lead that Part 17's record rule implies imported spirits can be claimed.

## Stage 4 — Operations, alongside Stage 3

- **Leaving the page while a summary is being written** — BUILT 4 October 2026 (Part 2, migration 065,
  `DECISIONS.md` §161), to be released. Summarise and Turn into a checklist claim the conversation,
  answer at once and work after the reply; a second press waits; the row and the drawer say "Summary
  being written…" / "Checklist being built…". The paid production test in `docs/TESTING.md` proves it
  on Vercel.
- **The cron release for all four jobs** (Part 3). The write-up is `docs/reports/workspace-task2.md`.
- **Rebuild staging from empty — the REHEARSAL is DONE**, 4 October 2026, on staging, by the
  `npm run db:restore` run after migration 065: 66 migrations, `000` → `065`, every verify block
  passing (`DECISIONS.md` §161). It ran early, under the old rule, and wiped staging's conversations,
  documents, fixtures and cost ledger. **The final rebuild still stands, just before the final
  workspace release** — and only when the owner's brief says so (`CLAUDE.md` §3.7).

## Stage 5 — After the workspace ships

- **The shared answer store.** Answers keyed by rule and state, never by company, each with
  "checked on" and a refresh rule.
- **The mothership map**: who publishes the binding text for each rule.
- Both feed the requirements table.

---

## The smaller open items

They are in `docs/HANDOFF-CODE.md` §7, one row each, with where and why.

## The standing rules

- Draw before building.
- Point at the line. A claim without a file and line is a hypothesis.
- Haiku for machinery; Opus 5.5 for report quality.
- Quality changes are shown first, and measured one at a time.
- Web search, with the mothership rule: get the text from whoever publishes it.
- Plain, short sentences for the customer. Never "AI". No cost on customer screens.
- `npm run cost` before and after every task. $3 per task.
- `check:live` only on port 3999 — including inside `npm run db:migrate`
  (`CHECK_LIVE_BASE_URL=http://localhost:3999`; `HOW-WE-BUILD.md` §3c).
- Start a fresh session when the context runs low.
- The release routine: `docs/RELEASE.md`.
