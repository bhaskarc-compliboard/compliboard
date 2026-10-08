# The Compliance Workspace — what's left

**Version:** 8 · **Updated:** 8 October 2026, items 3 and 4 done by HR Step 10 (the timing; the writer by section). Version 7: **Updated:** 7 October 2026, item 7: the politeness fix to the summary prompt (§173). Version 6: 7 October 2026, HR Step 4a: item 6, the list moved to shared files. Version 5: 4 October 2026, HR Step 2: adds "Coming from the HR section". Version 4: at the close of the workspace work (housekeeping), to mirror
the owner's map as it stood that evening. Version 3: Stage 4's cron release built. Version 2: Stage 4's first
item built and the rebuild-from-empty rehearsal done. Version 1 was written after the Workspace Task 6 release.

> **The owner's working copy is a Claude Doc, "Compliance Workspace — the map of what's left"**
> (https://claude.ai/artifact/W5BtmShWGoL5Z9uCLVHuwb). **This file mirrors it**, so the next session can read
> the plan from the repository. When the two disagree, the owner's doc wins and this file is corrected.

Stages 1 to 3 run in order; Stage 4 runs alongside Stage 3; Stage 5 starts only after the workspace ships.
**Stages 1 and 2 are done, and Stage 4's three main pieces are done. What is open:** Stage 3's three rev 1
items, Stage 4's `check:live` split and the final rebuild, and everything from Stage 5 on.

---

## Stage 1 — The Task 6 release · DONE, 4 October 2026

Migration 064 on production, the code pushed (`a701436`), `AI_MODEL_HOWTO` and the two search limits on
Vercel, `AI_EFFORT` re-entered as visible `medium`. The owner's live checks: a checklist shows three groups
and must-do counts; one paid "How do I do this?" on MNBP registration gave 7 official steps and printed
correctly. `DECISIONS.md` §158.

## Stage 2 — The polish pass · DONE, 4 October 2026 (`04f81c6`, `94f630b`)

Screen work only, no model or prompt change. `DECISIONS.md` §159, §160.
- **The summary drawer as an accordion** (board 6b): each authority folded with "N things to do", Still to
  confirm never folded, "Open all", print always fully open.
- **One-line source links**: "[n] host · title", cut with "…", the full title on hover.
- **A printed checklist with "How do I do this?" steps**, looked at on paper.
- **The site header no longer prints** over a drawer.
- **Our own print frame** (board 10): company and document type on every page, absolute dates, "Prepared
  with CompliBoard" and "Page n of N" in the footer, the browser's own header and footer off.
- **The conversation's Download** prints with the same frame, through one shared print function
  (`lib/printFrame.ts`).

## Stage 3 — The quality pass: research, sources and cost

**Decided 4 October, for rev 1** (the owner's map): this stage keeps only what protects customers from
confident mistakes — **the consistency check (6), the quote check (7) and the held list below**, including
the numbers check. **Items 2–5 and 9–11 move to rev 2**, with the requirements library. **The baseline (1)
is built later, from real problems brought by potential customers in different industries**, not from cases
we invent.

Each item is measured against the baseline, one at a time, on the same four measures: obligations missing
from the final state; items stated more firmly than their evidence; the share of steps and claims taken from
the agency's own pages; searches, tokens and cost per call.

| # | Change | What it fixes | When |
|---|---|---|---|
| 1 | Baseline run of the fixed cases on Opus 5.5 everywhere | The yardstick | When real problems arrive |
| 2 | Mothership first: the agency's own domains, then open search with copy sites blocked | Medium effort found more copies of the rule, not the rule | Rev 2 |
| 3 | Read the item's already-cited page before searching | A page read is cheaper than a search | Rev 2 |
| 4 | Check the search tool version; the newer one filters results first | Pages read, not searches, are the cost | Rev 2 |
| 5 | Effort on research: low, medium, high, after item 2 | Effort changes how much is searched, not which source | Rev 2 |
| **6** | **Consistency check**: one narrow pass asking which items depend on something still to confirm, for the summary and the checklist | Drawback and the tariff stated as settled | **Rev 1** |
| **7** | **Quote check for "How do I do this?"**: each step's words must appear on its page | Today the link is proven, not the words | **Rev 1** |
| 8 | Research answers cite at the source | 16 of 65 paragraphs in the ethanol chat carried a citation | Not assigned in the map |
| 9 | A cheap model fetches and trims; Opus writes from the trimmed evidence | Opus reads a little instead of a lot | Rev 2 |
| 10 | Tune the search limits (6 and 8 today) | A safety rail today, a measured setting after | Rev 2 |
| 11 | "Everything on this subject" stops re-adding discussed points as new | Duplicates labelled "newly checked" | Rev 2 |
| 12 | Coverage check, only if omissions reappear on Opus | Opus has covered every obligation so far | If needed |

**Held for the final-model run (rev 1).** Small fixes found along the way, held until every feature runs on
its final models and settings; each is tested then, and dropped if no longer needed (`DECISIONS.md` §158):
- Old checklists claim an order they never had.
- The research contradicts its own item (MNBP registration: 27 CFR 17.21 puts it with the first drawback claim).
- Section-level citations (17.21, not all of Part 17).
- A numbers check (the "$5,400 per 55-gallon drum" that should be about $1,426).
- Steps that belong to other items.
- A lead on drawback for imported spirits (Part 17's record rule).

## Stage 4 — Operations, alongside Stage 3

- **Leaving the page, and pressing twice — DONE, live 4 October** (migration 065, `cfe1889`, `DECISIONS.md`
  §161). Summaries, checklists and "How do I do this?" claim the conversation or item in the database, reply
  at once and finish after the reply (`lib/topicClaim.ts`, `after()`); a closed tab cancels nothing and a
  second press waits. The row and drawer say "Summary being written…" / "Checklist being built…". Proven on
  production by closing the tab mid-summary (the owner's map).
- **The cron release, all four jobs — DONE, live 4 October** (`14eb03b`, `DECISIONS.md` §162). Each job
  answers Vercel's GET with `Authorization: Bearer <CRON_SECRET>`; manual POST runs keep working; safe against
  a double delivery. The sweeps show GET 200 in Vercel (the owner's map). **Still to see:** the first
  `summarise` and `delete` rows in production's `job_runs` the next morning, and CB-Test-3's old conversation
  reading "Summary ready" (`docs/TESTING.md`, CR-2 and CR-3).
- **The two follow-ups — DONE 4 October** (`57c754c`, `DECISIONS.md` §163): an empty sweep writes no
  `job_runs` row; `check:live` counts all three checklist groups.
- **Split `check:live` into machinery and quality — OPEN.** On Haiku it always ends FAILED, because some
  checks judge answer quality Haiku cannot meet (the attachment's tier and errors, template findings, and a
  prose reply to "Everything on this subject"). A gate that is always red gets ignored. Machinery checks must
  pass on any model; quality checks are reported and judged only on Opus.
- **Rebuild staging from empty — OPEN, just before the rev 1 launch.** **The rehearsal happened on 4 October**:
  the restore during Part 2 rebuilt staging from zero (66 migrations, `000` → `065`, every verify passing,
  `DECISIONS.md` §161). It also wiped staging's test data without asking, so `db:reset` and `db:restore` now
  run only when the owner says so (`CLAUDE.md` §3.7).

## Stage 5 — After the workspace ships: the shared answer store and the mothership map

The biggest cost saving, and real design work, so it is its own project.
- **Shared answers**, stored by rule and state, never by company, each with its "checked on" date.
- **A refresh rule**: re-research after a set time (for example 90 days), or sooner when a cheap re-read shows
  the source page changed.
- **The mothership map**: every confirmed official page recorded against the kind of rule and the state.
- **A cheaper model, where measurement allows**, once the source is pinpointed.
- **The requirements table**: the map and the stored answers feed it.

Open design questions (the owner's map): what the stored question looks like with no company details in it;
who can see a shared answer; how refresh is triggered; how the map links to the requirements table.

### Rev 2 of the app: one library, fed by research

The owner's decision, 4 October: **the first release stays on open Claude research.** The requirements library
is not used for answers or sources in rev 1. Stage 5 belongs to rev 2, built around what already exists:
- **The requirements library is the mothership map.** `requirement_templates` (205 rows, 200 live), each with
  its agency (`agencies`: 33, each with a `url` and a `review_interval`), jurisdiction, citation and citation
  link, and the conditions that decide when it applies.
- **Research looks in the library first.** A matching requirement's citation link and agency site are read
  directly, with no discovery search.
- **What research finds that the library lacks is recorded** in `library_candidates` — name, state, industry,
  citation and agency guesses, `times_seen`. The most-asked become library entries, checked by a person.
- **Research keeps the library fresh**: a confirmed agency page refreshes the requirement's citation, on the
  agency's review interval.
- **Then tailoring**, with company facts and the library together.

## Counters on the dashboard, then the homepage

The owner's request, 4 October: show how much the product has done — first to each customer on their dashboard,
then publicly on the homepage once the numbers are large.
- **What is counted:** conversations, counted as each answered question (four back-and-forths are four), and
  checklists produced.
- **What already exists:** the usage counters (migration 032) record events and never go down. The answer count
  moves once per finished answer; a stopped one does not count. Since Workspace Task 2, the checklist count moves
  only when a checklist is actually saved. **To check:** whether "How do I do this?", summaries and box
  checklists are counted, and name each counter.
- **The dashboard:** each customer sees their own totals; it reads an older checklist column today and moves onto
  the counters.
- **The homepage, later:** totals across all customers, only as sums, never anything about one company.

## When every section is done

Checks across the whole app, held until every section has its new look:
- **Every print action uses the one print frame.** List every print action (`window.print`, `printDrawer`, any
  print CSS), with file and line, and make each use the same shared print style (`lib/printFrame.ts`): our
  header, footer and page numbers, the browser's own header off. One shared style, never a copy per page.

---

## Coming from the HR section — 4 October 2026

The HR section is being rebuilt as a copy of this workspace (`docs/HR-PLAN.md`, `DECISIONS.md` §164). Five
things in that plan change files this workspace owns. **The HR chat does them, in its foundations task (HR
step 3) and its operations task (HR step 10).** Until then, the workspace chat should not change these files
without the owner knowing, or the two sections will edit the same lines at once.

1. **The shared pieces (HR decision 1).**
   - These move out of `app/compliance/page.tsx` into shared files:
     - the four button strings `PRIMARY`, `SECONDARY_LARGE`, `OUTLINE` and `TEXT_ACTION`, into one file
       (`DESIGN.md:190` says this is owed);
     - `Sheet`, `Empty`, `FoldRow`, `OneLineLink`, `Working`, the stages and the tabs;
     - the page's print CSS, into `app/globals.css`;
     - `ReportView`, with the source shape as a parameter.
   - The workspace imports them. **No visible change:** `npm run measure` before and after proves the screen
     is the same.
   - The workspace's own logic stays in its page.
2. **A section column on `topics` (HR decision 5).** **DONE 4 October, on staging** (HR Step 3b: migration 066,
   `7b7c860`; the list filter `c7121a0` — testgamma's 20 rows unchanged, `npm run measure` byte-identical).
   Reaches production with HR's release.
   - `'workspace'` or `'hr'`, default `'workspace'`, so every existing insert keeps working.
   - `topic_list_v` exposes it, and the workspace's Conversations list filters to `'workspace'`.
   - The usage counter stays one count per company.
3. **Same-night timing (HR decision 13).** **DONE 8 October 2026 by the HR chat** (HR Step 10, `c6e9ae2`,
   `DECISIONS.md` §178). **For the workspace chat:** workspace summaries now run at **10:00 UTC**, for every
   conversation quiet for **6 hours or more** (`IDLE_HOURS = 6`; "6 hours or more" — a conversation quiet for exactly
   6 hours counts, where the old rule needed strictly more than its hours). The deleter runs at 10:30 UTC. A workspace
   conversation's summary call is unchanged; only the timing moved.
   - The summary job moves to 10:00 UTC and the deleter to 10:30 UTC (`vercel.json`).
   - The quiet rule goes from 24 hours to 6 (`lib/topicClaim.ts` `IDLE_HOURS`, and its test).
   - A workspace conversation that ends at 5 pm is summarised that night. One picked up again the next day is
     summarised again the following night (HR decision 23, accepted).
   - This reverses part of `DECISIONS.md` §161. No screen words change: "The summary is written overnight"
     stays true, since 10:00 UTC is 3 am in Oregon in summer and 2 am in winter.
4. **The nightly summary job chooses the writer by section (HR decision 14).** A workspace conversation gets
   the same writer as today. **DONE 8 October 2026** (HR Step 10): HR conversations go to the one writer with kind
   'hr', only while `HR_PREVIEW` is on; a workspace conversation's call passes no kind, exactly as before.
5. **Three workspace rows added to `docs/HANDOFF-CODE.md` §7** by HR Step 1 (`docs/HR-MACHINERY.md` B2, B3):
   - a failed attachment is answered around when other files loaded (`app/api/chat/route.ts:270–275`, `:472`);
   - carried files past three, and carried files that fail to load, drop silently, and only the model is told
     (`lib/attachedDocument.ts:199–206`; `app/api/chat/route.ts:228–230`);
   - the failed line shows the provider's raw error text for a refused large file (`lib/ai.ts:939`;
     `app/api/chat/route.ts:510`).

   These are the workspace's to fix, not HR's: HR uses its own loader (HR decision 3).
6. **The conversation list's helpers, its reading and its row moved into shared files** in HR Step 4a
   (`fd8cedc`, `DECISIONS.md` §166), out of `app/compliance/page.tsx`, with **no visible change, measured**
   (element dumps, full text, pixels and `npm run measure` identical on fresh servers):
   - `lib/listWords.ts`: `LIST_CAP`, `countOf`, `countWord`, `displayTitle`, `startOfDay`, `daysAgo`,
     `listGroup`, `listWhen`, `summaryWords`, `fmtDate`, `groupByDay`;
   - `lib/topicList.ts`: `TopicRow`, `TopicListRow`, `TOPIC_LIST_COLUMNS`, `toTopicRow`, and
     `readTopicList(db, section)`, which the workspace calls with `'workspace'`;
   - `components/ConversationList.tsx`: the day-grouped list and its row.

   HR uses the same files. A change to any of them changes both sections' lists.
7. **A politeness fix to the WORKSPACE's summary prompt** (the owner, 7 October 2026; `DECISIONS.md` §173).
   Production showed a workspace summary whose situation read "You did not share any facts about your business.
   You did not give your headcount or say whether you have a location in Portland."
   - **The prompt:** one sentence was added to `prompts/summary-report.ts`, at the end of rule 7: when the person
     stated nothing about their business, "situation" is an empty string, and missing details that would change
     the answer go under to_confirm as plain questions. HR's prompt carries the same sentence.
   - **The drawer:** `components/ReportView.tsx` (shared) shows the fixed sentence "No details about your
     business came up in this conversation." in the grey note style when the situation is empty;
     `renderPlainText` writes it too.
   - **Every workspace summary written from now on** (the button and the nightly job) uses the new prompt.
   - **A quality change,** to be judged on Opus in the testing step.

---

## The smaller open items

They are in `docs/HANDOFF-CODE.md` §7, one row each, with where and why. None blocks the stages above; pick
each up when a stage touches the same code.

## The standing rules

- Draw before building: boards on the canvas, the owner says "that one", then one instruction.
- Point at the line. A claim without a file and line is a hypothesis, and is checked.
- Haiku for machinery; Opus 5.5 for anything a customer relies on.
- Quality changes are shown first, and measured against the baseline one at a time.
- Research uses the web, mothership first; government and official pages are trusted; anything else gets its
  exact link and "looks correct, check it".
- Plain, short sentences for the customer. Never "AI". No cost on customer screens.
- `npm run cost` before and after every task; a $3 cap per task unless the owner raises it.
- `check:live` only on port 3999 — including inside `npm run db:migrate`
  (`CHECK_LIVE_BASE_URL=http://localhost:3999`; `HOW-WE-BUILD.md` §3c).
- Start a fresh session when the context runs low.
- The release routine: free `check:live`, preflight, `db:migrate:prod` (typed PRODUCTION), push, Vercel green,
  the free live checks, then the paid one (`docs/RELEASE.md`).
