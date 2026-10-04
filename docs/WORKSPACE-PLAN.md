# The Compliance Workspace — what's left

**Version:** 1 · **Written:** 4 October 2026, after the Workspace Task 6 release.

> **The owner's working copy is a Claude Doc, "Compliance Workspace — the map of what's left".
> This file mirrors it**, so the next session can read the plan from the repository. When the two
> disagree, the owner's doc wins and this file is corrected.

The plan has five stages, in this order. **The next session starts at Stage 3.** *(Stage 2 done 4 October 2026.)*

---

## Stage 1 — The Task 6 release · DONE, 4 October 2026

Migration 064 is on production, the code is pushed (`a701436`), and the new settings are on Vercel.
The owner's live checks passed. `DECISIONS.md` §158.

## Stage 2 — The polish pass · DONE, 4 October 2026 (`04f81c6`)

Built as below, plus one fix the print check found: the site header no longer prints over a drawer
(`components/AppLayout.tsx`). `DECISIONS.md` §159. The owner's live checks: `docs/TESTING.md`,
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

- **Leaving the page while a summary is being written.** Prove what happens, add "Summary being
  written…", and make a second press wait. Raised with the mothership work.
- **The cron release for all four jobs.** The write-up is `docs/reports/workspace-task2.md`.
- **Rebuild staging from empty** (`npm run db:reset`), just before the final workspace release.

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
