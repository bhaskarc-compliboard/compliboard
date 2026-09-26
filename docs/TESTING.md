# Testing
**Version:** 24 · **Updated:** 25 September 2026
**Supersedes:** version 23 (24 Sep). Adds the **Documents Run 1 set** — three documents run from
`npm run scan`, because Run 1 builds the scan and its tables and there is no screen yet. The set
carries two warnings: `.env.local` runs Haiku with search capped at 2, so these judge the SHAPE
of a scan and not the reading; and **D1-3, the unreadable file, is the one that matters most** —
if it ever returns gaps or facts, the scan has started answering around a document nobody read,
which is the audit engine's standing defect arriving in a new place. Version 23: version 22 (23 Sep). Adds the **Layout pass set** — nine actions across the
conversation view, the checklist drawer, the summary drawer and the two lists, written against
`docs/DESIGN.md`. Two warnings sit at the top of it and both were paid for: **`.env.local` runs
Haiku**, so answer quality on a laptop is not the product's and these tests judge position rather
than prose; and **hard-reload first**, because a stale bundle makes every row look right and do
nothing, which cost two rounds during the pass. Version 22: version 21 (23 Sep). Current as of the production ship: migration 039 is on both
databases, and the three manual sets below — R3's ten, Fix Round 1's four, Fix Round 2's two —
**are all still unclaimed.**

> ### ⚠ AND THE RESEARCH SECTION IS NOW LIVE ON PRODUCTION WITH NONE OF THEM RUN.
>
> Every earlier version of this file could say the manual pass was the gate before shipping.
> It is not that any more: the code shipped. **Sixteen actions across three sets, and nothing in
> this repository claims a person has done one of them.** That is not an argument for skipping
> them — it is the reason they matter more now than when they were written, because a failure
> they would catch is in front of customers rather than behind a flag.

Version 21: version 20 (23 Sep). Adds the **FIX ROUND 2 set** — attach a file and ask about
it, and the file card's wording. The important half is asking a SECOND question: the first
version of that fix carried the document on the attach turn only, and a later turn then retracted
a correct finding. One question would not have caught it. Version 20: version 19 (23 Sep). Adds the **FIX ROUND 1 set** — four actions, one per defect
the owner's 22-23 September pass found and no script had caught: attach a file and see it
classified, an answer that stops on its own, a third turn standing by its sources, and printing a
drawer. **F3 is recorded as FAILING and stays in the set** — the fix that was asked for is in and
proved, but asked directly whether its sources were real the model still hedges, because history
reaches it as plain text with the tool-use blocks stripped. `AUDIT-CHECKS.md`'s rule applies: a
check is recorded with the answer on the day it was run, including where that answer is bad.
Version 19: version 18 (23 Sep). Adds the **R3 finish-line set** — the seven actions the owner
runs before the research/checklist section ships, plus three that fail quietly: stopping an
answer, deleting a conversation, and the 820px layout where **Delete must be visible without a
hover** because touch has no hover. The note at the end says what `check:live` proves and what it
cannot: it covers the routes, not whether an answer reads as an answer. Version 18: Adds the **R2 manual set** — two tests each for a conversation
that survives a reload, stop, the nightly summariser, the nightly deleter and conversion with
scope (`DECISIONS.md` §125). The edge cases are where the domain work is: whether a cleared
transcript reads as the product working or as loss, whether a fact proposal is a fact about THIS
business rather than a true statement about the regulation, and the backstop, which only fails
when something else is already broken. Version 17: version 16 (15 Sep). Adds the **R1 manual set** — two tests each for streaming,
stop, history, the checklist shape and background micro-steps (`DECISIONS.md` §123). The edge
cases are where the domain work is: whether the narration withdrawal reads as a glitch, whether a
follow-up carries the subject without repeating itself, whether checklists stored before the shape
was cut still render, and whether closing the tab mid-generation costs a full regeneration on the
next open. Version 16: version 15 (13 Sep). **Case A has a defect in its own precondition** — a company
with nothing established cannot show a count MOVING, only a list being CREATED, so the case cannot
observe what it was written for. Run for the first time on a new fixture (Test Gamma Solvents):
**21 applies of 200 created, 0.5 s, 7 questions unblocked.** That is the fresh-company figure; **a
genuine delta figure does not exist yet.** Case A should split into A1 (creation) and A2
(movement). Version 15: The 4.3/M6 manual set is recorded as **RUN, by a person, in a
browser** — not as written. It found two things no automated check could, on its first attempt:
**Case E crashed on its first fixture** (a 500 for every uncomputed company, which on production
was all ten), and **Case G's domain half surfaced the 22 clauses that can never be true.**
Version 14: Records Case F **in the data** — Beta ends at open 0, closed 1,
the seeded obligation closed rather than deleted — and that Beta resolving to zero made Case I's
second empty state render **for the first time**, which was unreachable before 023. Version 13: Records the **first run: E, F, G and I pass functionally.**
Case E found a 500 on its first fixture (migration 023), and **Case G's domain half found the
library defect that 199 expression reviews had missed** — the argument for the manual set,
demonstrated. Version 12: Adds the **manual set for Phase 4.3 and M6** — five cases,
**and the visual half 7.2a deferred is now written**, marked `SEE` rather than merged into that
section. Case E carries an ordering trap that is real and unrecoverable: the first GET is what
fires the lazy write, so opening the screen destroys the before-state. Case F is the only fixture
in the project where a hand-made obligation meets the writer, and tests that history is closed
rather than deleted. Case G's second half is the one no script can do — whether a fact is actually
sufficient to rule a requirement out. Records what none of them can tell you: **0 of 205
requirement templates have been checked against a published source.** Version 11: The **7.2a manual set is narrowed to API and state**, with
the visual half explicitly deferred to M6 and the reason stated in the set itself: a case that
always fails for a reason unrelated to what it tests trains whoever runs it to skip failures.
Version 10 added the **manual set for Phase 7.2a**, written before the UI
exists so it tests what was meant rather than what got built — four cases, each naming what it
is blocked on, and each with what the failure looks like. Case A is the one that matters: one
answer must unblock two questions AND move 19 obligations in the same interaction, and the four
distinct ways that goes wrong have four distinct causes. Version 9 added **`npm run test`'s three
guards** — no `.only`, nothing
skipped, and a committed floor the total may rise above but never fall below, both refusals
proved by breaking the suite. Records the actual count history (**167**, never 100 or 106) so
the question does not have to be re-asked. And records that the **golden document cases are
blocked on a decision, not on effort**: a case needs a committed document and the only
candidates are customer-uploaded files. Version 8 added **`npm run mutation`** — nine deliberate breakages of
the resolution engine, all nine caught, because a suite that has only ever passed is
consistent with a suite that asserts nothing. Records what a wrong implementation looks like
for each property, which is the part a passing test cannot tell you. Version 7 added **the expression layer's three invariants** — a new
class, because they are tests of a body of DATA and a violation is silent: a condition naming a
switch nobody defined is valid JSON that evaluates to `unknown` forever. Records that the
manual test for this layer is a read rather than a click, and the two known-failing cases kept
visible on purpose. Version 6 supersedes version 5 (12 Sep). Adds an assertion CLASS rather than a case — every
threshold in an expression must be quoted from the rule's own text, never derived — which
caught a figure imported from a neighbouring rule on its first run. Version 5 recorded the
question-7 variance — the gate's
`non_blocking_unknowns` came back with three entries, then two, then zero on the same case —
as a (c) consistency probe rather than a bug to solve now. And replaces the recalled
"readiness numbers differed between runs" with the measured version from
`baseline-outputs/audits.json`: six audits of the same 272-item standard for the same company,
satisfied ranging 6 to 21. Version 4: (b) is no longer future — `npm run golden` exists, with
three cases and four verdicts of which SKIP is never a pass. Version 3 added the **2.2 manual
set** — including the unbuilt-industry
case, where a clean gate and an unanchored answer look identical on screen, because "do we know
enough about YOU" and "do we know enough about your INDUSTRY" are different questions and 2.2
answers only the first. Records that the golden runner now exists as `npm run golden`.
Version 2: golden-file case 001 gains two assertions beyond the
original one: the answer must draw on **no Oregon agency** (Reno to Philadelphia is entirely
federal — 22 of 200 live rows are in scope), and it must **say that origin and destination
state requirements are not covered** (neither Nevada nor Pennsylvania is in the library).
Records that assertion 2 was unfalsifiable before Phase 2.1 and is a `WHERE` clause now.

**Status: (a) is a standing obligation and starts now. (b) is specced in `TODO.md` 2.8 with
two cases written. (c) is not built and is deliberately bounded.**

---

## The suite may grow. It may not silently shrink — `npm run test`

Added 12 September 2026. `npm run test` is `scripts/test-guard.js`, which runs the suite and
then refuses three things:

| Guard | Refuses |
|---|---|
| **no `.only`** | a stray `.only` narrows a run to one test and reports **green** |
| **0 skipped, 0 todo** | a skipped case disappears into a count nobody reads |
| **a committed floor** | the total may rise above it, never fall below |

**Both refusals were proved by breaking the suite on purpose**, then restoring it:

```
test-guard: .only found in jurisdiction.test.ts — the suite would report green
            having run almost nothing.
test-guard: 1 skipped
```

**Why this is the harness doing the thing the checks exist to prevent.** Check 14 records that a
checker weaker than its assertion is indistinguishable from a passing suite. A narrowed *run* is
the same failure one level up: nothing errors, nothing is red, and the only signal is a number
in a summary line. `HOW-WE-BUILD.md` §3's rule — a validator that has only ever said PASS is
untested — applies to the runner as much as to anything it runs.

**On the count itself**, recorded because it was queried: the suite has been **1 → 37 → 58 →
119 → 133 → 164 → 167**, each step after adding tests, and three consecutive runs on 12 Sep gave
**167 · 0 skipped · 0 todo**. Per file: `appliesExpression` 58 · `jurisdiction` 24 · `resolve`
40 · `sdsExtraction` 14 · `switchDetermination` 31. **No run in this project has reported 100 or
106.** The floor is committed so the question does not have to be re-asked.

---

## Manual set — Documents Run 1, the scan and its contract, 25 Sep 2026

**Three documents, run from a script — there is no screen yet.** Run 1 builds the scan and the
tables it writes; the page and the drawer come later. So these are run with `npm run scan` and
judged by reading the JSON it prints and the rows it wrote.

> ### ⚠ `.env.local` RUNS HAIKU, AND `DEV_MAX_SEARCHES` CAPS SEARCH AT 2.
>
> What a Haiku scan *says* is not what the product will say — `CLAUDE.md` §3.4a. **Judge the
> SHAPE**: did it come back at all, are the fields filled, is an unreadable file said out loud,
> is a quote checked against the file. To judge the reading itself, point it at the real model:
> `AI_MODEL_DOCUMENT_SCAN=claude-opus-5 npm run scan -- <file>`.

**Setup:** staging, `.env.local` as shipped. Nothing here touches production; the script refuses
the production ref by construction.

| # | Action | Steps | What must be true |
|---|---|---|---|
| **D1-1** | **A policy with real gaps** | `npm run scan -- tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf --times 3` | Three scans complete. Each prints a full JSON, a cost row with a model, tokens, searches and a dollar figure, and a quote line. `kind` is a policy or program, not a permit. **Gaps are found** — this document has planted errors. The variance table prints at the end: `kind`, `title`, `status` and `significant_date` should hold across all three; **the gap count will not**, and that is the finding, not a fault |
| **D1-2** | **A permit-shaped document** | `npm run scan -- tests/golden/storm_water.pdf --times 3` | Three scans complete. The variance table shows **most fields identical** across the three — this document is far more stable than D1-1, and the contrast is the point. Check the cost row is present on every run |
| **D1-3** | **A file nobody can read** | `npm run scan -- tests/fixtures/unreadable-blurred-page.pdf` | `status` is **`could_not_read`**. `could_not_read.reason` says plainly that the page is blank or illegible, and `way_forward` says what would fix it. **`gaps` and `facts` are empty** — nothing is invented about a document nobody read. `documents.status` is set to `could_not_read` |

> ### WHAT D1-3 IS REALLY TESTING, AND WHY IT IS NOT OPTIONAL.
>
> The audit engine's standing defect is that it drops a document it cannot read with a console
> line and computes a readiness number from the rest. The whole point of the Documents section is
> that this stops. **An unreadable file is a status, said out loud, with the way forward** — never
> a log line, never silently missing from a count. If D1-3 ever produces gaps or facts, the scan
> has started answering around a document it did not read, and that is the most serious thing
> that can go wrong here.

**Two more things worth running when the scan changes**, both proved once on 25 September:

- **A Word file** — `npm run scan -- tests/fixtures/kitchen-rota-notice.docx`. It exercises the
  shared parser (`parseDocumentToBlocks`), which the OLD review path does not use, and it is the
  only fixture with extractable text, so it is the only one where the **quote check actually
  runs**. Expect `2 of 2 checked quotes found word-for-word`.
- **A broken parse** — break `JSON.parse` in `lib/documentScan.ts`, scan anything, and the run
  must **not throw**: `status` `could_not_read`, the reason *"the reading came back in a form we
  could not use"*, and the whole answer kept in `document_scans.raw_text`. A paid answer is never
  discarded.

---

## Manual set — Layout pass — Compliance Workspace, 24 Sep 2026 (`docs/DESIGN.md`)

**Nine actions across four areas.** The layout pass rebuilt the Compliance Workspace screen by
screen; `docs/DESIGN.md` is the template that came out of it. **These tests check where things
sit on the page, never how good an answer reads.**

> ### ⚠ `.env.local` RUNS HAIKU BY DESIGN. ANSWER QUALITY ON THE LAPTOP IS NOT THE PRODUCT'S.
>
> `CLAUDE.md` §3.4a: prose, judgement, substeps and summary all point at `claude-haiku-4-5`
> locally, and those variables are **unset in production**, which runs Opus 5 and Sonnet 5. So a
> thin or wrong answer here is not a finding. **Judge position, weight, colour and spacing.** To
> ask whether an answer is any good, run `npm run golden:facts -- --model claude-opus-5`.

> ### ⚠ AND BEFORE ANY OF THESE: HARD-RELOAD. Cmd+Shift+R.
>
> A stale bundle makes every row look correct and do nothing — the markup is new, the handlers
> are old. **This cost two rounds during the pass**, one of them spent diagnosing a regression
> that did not exist in the code. If something here fails, hard-reload once before reporting it.

**Setup:** signed in on staging, `npm run dev` pointed at staging.

### A — Conversation view

| # | Action | Steps | What must be true |
|---|---|---|---|
| **A1** | **Ask a question and read the answer** | Ask anything, wait for the answer to finish | The answer has **no box around it** and runs the full column width. Your question sits in a **grey block on the right**. Under the last answer — **and only the last** — there is one outlined green button and two plain text actions. Scroll to the bottom: the composer is **part of the page, below the last answer**, not a bar floating over the footer |
| **A2** | **A conversation of several turns** | Ask a second and a third question in the same conversation, then a fourth | The action row is under the **newest answer only**; earlier answers have none. After four answers the wrap-up nudge appears as **plain text with a hairline above it**, not as a grey card |

### B — Checklist drawer

| # | Action | Steps | What must be true |
|---|---|---|---|
| **B1** | **Open a checklist** | Checklists tab → open one | Items are **rows with hairlines between them**, not bordered cards. Run your eye down the left edge: **every checkbox sits at the same x**. Tick one — it turns green and the progress bar moves |
| **B2** | **Print a long one** | Open a checklist with **twenty or more items** → **Download** | Every item is on the paper, page breaks **do not cut an item in half**, the **company name and date** are at the top, and **no button** appears in the printed output |
| **B3** | **The first open, while steps are still being written** | Make a new checklist and open it **for the first time**, while its micro-steps are still generating | The **"steps being written…"** note shows on screen. Press **Download while it is still showing**: the note is **not on the paper**. Open the same checklist again — the note is gone, the steps are there, and **no further model calls are made** |

> ### B3 CAN ONLY BE TESTED ON A FIRST OPEN, WHICH IS WHY IT IS WORDED THAT WAY.
>
> Micro-steps now persist (`DECISIONS.md` §130). The note appears only on the first open of a
> checklist that has none, so a second open cannot produce it. Testing it later is not a weaker
> version of this test — it is not this test at all.
>
> The "no further model calls" half is checkable rather than a matter of faith: `npm run cost`
> before and after the second open, and the `substeps` count must not move.

### C — Summary drawer

| # | Action | Steps | What must be true |
|---|---|---|---|
| **C1** | **Open a summarised conversation** | Conversations tab → a row marked summarised | The summary is **in the serif**. The footer has **"Open the conversation" as an outlined green button** and the rest as plain text. Press **Download**: the summary prints **alone, with no page behind it** |
| **C2** | **One whose transcript has been cleared** | Open a conversation summarised more than 7 days ago, so its `turnCount` is 0 | **"Open the conversation" is absent**, the note about cleared messages shows, and **Download still works** |

### D — The lists

| # | Action | Steps | What must be true |
|---|---|---|---|
| **D1** | **Scan both lists** | Conversations tab, then Checklists tab | Rows are **grouped under a day heading with the date shown once**, not on every row. Hovering a row **lifts it to white and turns its title green**. Clicking the title opens its drawer. **Delete is visible without hovering** |
| **D2** | **A single-row group with a long title** | Find a day group with one row, and a title long enough to truncate | The **group heading still appears**, the long title **ends in an ellipsis**, and **Delete sits at the same x** as every other row's |

---

## Manual set — FIX ROUND 2, the first production test (`DECISIONS.md` §129)

**Two actions. Both were found by using the product on production, not by any script here.**

**Setup:** signed in on staging, `npm run dev` pointed at staging. **Migration 039 is applied on
both databases as of 23 September** (40 applied, latest 039, `preflight` PENDING COUNT: 0) — it is
what makes the attachment link persist, and without it R2-1 fails at the last step.

| # | Action | Steps | What must be true |
|---|---|---|---|
| **R2-1** | **Attach a file, then ask about it** | Paperclip → `tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf` → then ask *"check this policy against Seattle's paid sick leave rules"* | The answer **is about the document**: it names the policy's own errors — the 30-day card window, cards "per establishment", the 180-day wait, the 24-hour carryover, find-your-own-cover, the tip credit, $20.76 — and works the tier from **both** locations (25 + 31). It must never say no file came through. **Then ask a second question about the file**: the answer must still know it, and must not retract what it said the first time |
| **R2-2** | **The file card's wording** | Attach anything the model classifies with a vowel-initial type | The card reads **"Read as: Employee Handbook Addendum"** — no article. "Read as a Employee Handbook Addendum" is the bug |

> ### THE SECOND HALF OF R2-1 IS THE PART THAT WAS GOT WRONG ONCE.
>
> The first fix carried the document on the attach turn only and gave later turns the stored
> review summary. Measured, it made turn two say *"I can't confirm that the policy contained a
> waiting period at all. I shouldn't have stated it as one of its errors"* — **retracting a true
> finding**. Asking a *second* question is what catches that, and one question does not.

`npm run check:live -- --only attachment` runs R2-1 end to end and prints the answer.

---

## Manual set — FIX ROUND 1, the owner's 22-23 September pass (`DECISIONS.md` §127)

**Four actions, one per defect that the test pass found and that no script had caught.** Each
one is here because the failure was *silent*: the product carried on as though nothing was
wrong, which is the class `CLAUDE.md` §5 exists to keep out.

**Setup:** signed in on staging, `npm run dev` pointed at staging.

| # | Action | Steps | What must be true |
|---|---|---|---|
| **F1** | **Attach a file, and see it classified** | Paperclip → choose a real PDF → send | A file card appears **in the conversation** naming what it was read as and **"Saved to Documents → …"**. Open Documents in another tab: **the file is there.** If the upload fails, the failure appears **in the conversation at the point of the attach** — never as a banner at the top of the page — and asserts **nothing** about the contents |
| **F2** | **An answer that stops on its own** | Ask something long. While it is writing, kill the dev server (or pull the network) | The answer **stops with a visible line saying it stopped early**, offering **Try again**, and the composer returns to ready. What arrived stays on screen. **A half-answer must never be shown with its action buttons as though it were finished** — that was the 22 September defect, and nothing on screen said so |
| **F3** | **A third turn standing by its sources** | Ask something that searches. Ask a follow-up. Then ask *"were the sources in your last answer real?"* | The answer **does not disown its own citations.** ⚠️ **This is the one that is not yet fixed** — see the note below; run it and read what comes back rather than assuming |
| **F4** | **Print a drawer** | Open a checklist (or a conversation summary) in the drawer → **Download** | The printed page contains **only that drawer's content**, with a header naming **the company, the title and the date**. The tabs, the other conversations and the composer are **not** on it. Citation markers print **inline** as `[n]`, not on their own lines. **"steps being written…" never appears** |

> ### F3 IS RECORDED AS FAILING, AND IT STAYS IN THE SET.
>
> The fix that was asked for — every earlier answer carries its numbered sources — is in and
> proved: the model no longer says the markers point at nothing. But asked directly whether the
> sources were real, it still hedges, because **history reaches it as plain text and the
> tool-use blocks that would show a search happened are not stored.** `AUDIT-CHECKS.md`'s rule
> applies: a check is recorded with the answer on the day it was run, **including where that
> answer is bad.** `npm run check:live` runs it every time and prints the model's own words.
>
> **The answer on 23 September 2026, verbatim from the run:**
>
> ```
> ✗ sources    turn three disowned its citations: "## Direct answer: no\n\nI did not run a
>              search before either of those answers. I wrote the citation markers and URLs
>              from memory and formatted"
>
> check:live FAILED — 1 problem(s). These are invisible to npm run check.
> ```
>
> Every other step in that run passed — research, checklist, conversation, reload, continue,
> counters, stop, both conversion scopes, topic GET, summarise, DELETE and history.

---

## Manual set — R3, THE FINISH LINE (`DECISIONS.md` §126)

**These ten are the owner's pass before the section ships.** The first seven are the finish-line
actions; the last three are the ones most likely to be wrong and least likely to be noticed.

**Setup:** signed in as a real user on staging, `npm run dev` pointed at staging, every pipeline
switch off.

| # | Action | Steps | What must be true |
|---|---|---|---|
| **1** | **Ask and get a sourced answer** | Open Compliance Workspace. Type *"Do we need to file a Tier II report for our Oregon plant?"* → **Research this** | Text appears **progressively**, not all at once. The answer has **no raw `\|` pipes and no stray `*`** — tables are tables, bold is bold. Each `[n]` opens a card with a title, a domain and a working link. The sources list under the answer shows a domain beside each title, and **no source reads as a bare domain or a broken PDF header** |
| **2** | **Continue the conversation** | Ask a follow-up that only makes sense in context: *"does that change if we move up a generator category?"* | The answer carries the subject **without restating the first answer**. The composer is now docked at the bottom; the three buttons and the examples are gone |
| **3** | **Upload a file and ask about it** | Paperclip → choose a PDF → ask *"check this for errors"* | A file card appears saying what it was read as and **"Saved to Documents → …"**. Open the Documents screen in another tab: **the file is there.** If it could not be read, the card says so in our voice and offers a clearer copy — and asserts **nothing** about the contents |
| **4** | **Convert to a checklist** | Under an answer → **Turn this into a checklist** → **Just what we discussed** | The scope sheet shows both options. The new checklist opens **in the drawer over the conversation**, not on a new screen. Every item is tagged **from this conversation**, and every source on it appeared in the conversation |
| **5** | **Summarise** | Under an answer → **Summarise this** | The summary drawer opens with a summary of what was asked and concluded. Go to **Conversations**: the row now reads **Summarised** |
| **6** | **Tick items, and reload** | Open a checklist → tick three items → **reload the browser** → reopen it | The three are still ticked and the progress reads **"3 of N done"**. This is the one people assume works |
| **7** | **Find and reopen a past conversation** | **Conversations** tab → click a row → **Open the conversation** | The whole back-and-forth is there in order, with each answer's own sources, and you can carry on from it |

### And three that fail quietly

| # | Action | Steps | What must be true |
|---|---|---|---|
| **8** | **Stop an answer** | Ask something long. When text starts, press the **stop square** | Text **stops within a second or so**. What arrived stays on screen. No error appears — you did this. Go to Conversations: the question is there, and the checklist/questions counter did **not** move |
| **9** | **Delete a conversation** | Conversations → hover a row → **Delete** → confirm | It goes from the list and does not come back on reload. If a checklist was made from it, **the checklist is still there** — clearing a transcript must never take the checklist with it |
| **10** | **The 820px layout** | Narrow the window below 820px, or open it on a phone | **Delete is visible without hovering** — touch has no hover, and a row whose only destructive action needs a hover is unreachable. Nothing scrolls sideways. The docked composer clears the bottom of the screen |

> ### WHAT A SCRIPT CANNOT JUDGE, AND WHY THESE ARE MANUAL
>
> `npm run check:live` proves the **routes**: that a conversation saves and reloads, that the
> counters behave, that `discussed` cites only what the conversation cited, that summarise marks
> the summary as the user's, and that delete removes the turns. It cannot judge **whether the
> answer reads as an answer** — whether the markdown looks right, whether a source title is
> recognisable, whether the stop feels immediate, or whether a cleared transcript reads as the
> product working rather than as loss. Those are 1, 3, 8 and 10, and they are why this set exists.

---

## Manual set — R2, conversations that persist (`DECISIONS.md` §125)

**Two per feature: the perfect case, and the edge case where domain knowledge does work no script
replicates.**

### A conversation that survives

| | |
|---|---|
| **Perfect** | Ask a question, wait for the answer, reload the page, reopen the conversation. Both messages are there, in order, with the answer's sources. Ask a follow-up — it carries the subject. |
| **Edge — the cleared transcript** | Open a conversation whose turns the nightly deleter has already removed. **It must say so** — "the messages were cleared 7 days after it was summarised; the summary is kept" — and show the summary. **What a script cannot judge:** whether that reads as the product working as promised or as the product having lost something. If it reads as loss, the wording is wrong, not the deletion. |

### Stop

| | |
|---|---|
| **Perfect** | Start a long answer, stop it. The partial text stays, no error appears, and the question is still in the conversation when you reload. |
| **Edge — the count** | Stop three answers in a row, then check the counter. It must not have moved at all. **A stopped answer is not a question answered**, and this is the one place a customer would notice us counting work we did not do. |

### The nightly summariser

| | |
|---|---|
| **Perfect** | Leave a conversation idle a day. The summary should describe what was asked and concluded, in the person's own subject matter, without adding advice nobody gave. |
| **Edge — the one that needs a compliance reader** | Check the **fact proposals** it extracted. Every one must be something the USER said about their own business, with a quote. **A proposal that restates a regulation — "OSHA requires forklift training" — is a failure even though it is true**, because it is not a fact about this company, and accepting it would put a rule into the facts the product reasons from. Only somebody who knows the difference can see it. |

### The nightly deleter

| | |
|---|---|
| **Perfect** | A topic past its `delete_after` loses its turns and keeps its summary. `job_runs` names the topic and the count. |
| **Edge — the backstop** | Disable the summariser for a month (or backdate a topic 31 days with no summary). **The deleter must still clear it.** This is the case that only fails when something else is already broken, which is exactly why it is worth testing deliberately rather than waiting for it. |

### Conversion with scope

| | |
|---|---|
| **Perfect** | Convert a conversation twice, `discussed` then `complete`. The titles differ, and the complete one has more items, some marked as added. |
| **Edge — the sources** | On the `discussed` checklist, open **every** source link and confirm each one appeared in the conversation. The route enforces this and reports a `dropped_for_unseen_source` count — **if that count is ever non-zero, the model reached past the conversation and the filter caught it.** Worth knowing when it happens rather than only that it was handled. |

---

## Manual set — R1, the open baseline (`DECISIONS.md` §123)

**Two per feature: the perfect case, and the edge case where domain knowledge does work no script
replicates.** All of these are run with every pipeline switch OFF, which is how production runs.

### Streaming

| | |
|---|---|
| **Perfect** | Ask *"SDS versus container label under OSHA HazCom"* in Ask mode. **Text must appear progressively, first words within ~2 s** — not a spinner then a finished answer. Measured 22 Sep: first text at 1279 ms, 11.3 s total. |
| **Edge — the narration withdrawal** | Ask *"Oregon cannabis extraction lab using butane — licenses and safety"*. The model opens with *"I'll help you understand…"*, **then searches**. Watch for that opening to be **withdrawn and replaced** when the search starts. **What a script cannot judge: whether the flicker reads as a glitch or as the product thinking.** If it reads as a glitch, the fix is presentation, not the rule — the rule is right and has 10 tests behind it. |

### Stop

| | |
|---|---|
| **Perfect** | Start a long answer, stop it after a few seconds. Partial text **stays on screen** — it is not wiped — and no error appears, because the user caused it. |
| **Edge** | Stop, then immediately ask a new question. **The new answer must not be contaminated by the aborted one** — no leftover text in the new exchange, and the stopped exchange is not re-used. Check the server log shows `AI: upstream aborted` for the FIRST request only. |

### History

| | |
|---|---|
| **Perfect** | Ask about propane storage, then ask *"what did I just ask about?"*. The answer must name propane. (Automated in `npm run check:live`.) |
| **Edge — the thing the script cannot check** | Ask a question, then a follow-up that only makes sense in context: *"does that change if we move to Washington?"*. **A correct answer carries the subject forward without re-stating the whole first answer.** A wrong one either forgets the subject or repeats itself at length — both pass a keyword test and only a reader can tell them apart. |

### Checklist shape

| | |
|---|---|
| **Perfect** | Ask for a checklist. Items render with a name, a description, a why and a source; the must-do / good-to-have split is right. Ticking an item persists across a reload. |
| **Edge — the stored rows** | Open a checklist **created before 22 September** (production has 11). Those items carry `cost_note` and `providers` and the current ones do not. **Both must render without a gap or a broken block.** The fields are optional in the type for exactly this reason, and nothing but looking at an old one proves it. |

### Micro-steps in the background

| | |
|---|---|
| **Perfect** | Create a checklist and **do not click anything**. Items should fill in with steps on their own, a few at a time, each showing *"steps being written"* until its steps land. Never more than three at once. |
| **Edge — never lost, never repeated** | Create a checklist, wait until 2–3 items have steps, then **close the tab while others are still writing**. Reopen the checklist. The finished items must **not** regenerate (watch the network tab: no call for them) and the unfinished ones must **start writing again**. This is the one that would silently cost money if it were wrong — a checklist regenerating every item on every open is invisible on screen and obvious on the bill. |

---

## Manual set — Phase 7.2a, the ask path

*HOW-WE-BUILD step 12. Written 13 September 2026, while the work was fresh.*

> ### ⚠️ THIS SET IS DELIBERATELY PARTIAL, AND IT IS NOT INCOMPLETE.
>
> **It tests the API and the state change. It does NOT test what a user sees.** Every case below
> is verified by calling an endpoint and querying a table — not by clicking a screen — because
> **the screen does not exist and belongs to M6.**
>
> **Why that distinction is made explicitly rather than left implied.** A case reading *"click
> Requirements and see 19 obligations"* would fail today for a reason that has nothing to do
> with the ask path: there is no Requirements screen. A manual set carrying cases that always
> fail trains whoever runs it to skip failures, and a skipped failure is how a real one survives.
>
> **So the visual half is deferred to M6's manual set, not dropped.** When M6 lands, each case
> below gains a "and the screen shows" half. The next person adding here should add API-and-state
> cases to this section and visual cases to M6's — **and should not merge them**, because the two
> halves fail for different reasons and get fixed by different people.

### Case A — the first answer. THE ONE THAT MATTERS.

**Do this.** A company with nothing established.

```
GET  /api/switches/ask                       → note the first question and `remaining`
POST /api/switches/answer  { has_employees, true }
GET  /api/switches/ask                       → compare
```

**Perfect — four assertions, all from the API and the database:**

1. The POST returns `written: true`, `evidence_class: 'stated'`, `state: 'known'`.
2. **Its `unblocked` array has exactly two entries** — `employee_count` and
   `site_employee_count`, which depend on `has_employees`.
3. `select count(*) from company_switches where switch_id='has_employees'` is **1**, with
   `user_locked = true` and a `basis` whose `kind` is `user_answer`.
4. **The obligation count moves.** Against the real library, `has_employees = true` moves
   **19 obligations** from `unknown` to `applies` for a two-site company:
   `select status, count(*) from obligations where company_id = … group by status`.

**What it looks like when it is wrong — four symptoms, four different causes:**

| Symptom | Cause |
|---|---|
| `unblocked` is **empty** | The recompute did not run. Children only become askable once the parent is known (§54) — the exact failure the recompute exists to prevent, and the first interaction in the product returns nothing |
| `unblocked` has two entries but `obligations` is unchanged | The answer was written and `close_and_replace_obligations` was not called. **`obligations_stale: true` in the response is the honest signal**; a caller ignoring it serves a stale list with no warning |
| `unblocked` has **more than two** | The unlock cascaded. §54 is one level — a grandchild from one click is the too-much-asking failure `DETERMINATION-GATE.md` refuses |
| The obligation count **falls** | **Stop.** Adding a fact can only settle an open question. Measured across every pair of states: **zero** `applies → does_not_apply` transitions |

### Case B — blocked, and excluded, are different

```
GET /api/switches/ask     → with nothing established
```

**Perfect:** the response contains blocked questions **with a non-empty `blocked_by`** naming
the switch they wait on, alongside the answerable ones. `remaining` counts both.

**Wrong:** blocked questions are absent from the payload. A caller cannot distinguish *"six
questions exist"* from *"thirty exist and six are answerable"*, and the ordering — which comes
from the dependency graph, not from a preference — becomes invisible.

**The edge case, and this is where domain knowledge does work no script replicates.**

```
POST /api/switches/answer  { hazardous_chemicals_present, false }
GET  /api/switches/ask
```

The **21 switches that depend on it must be absent entirely — not blocked.** A site with no
hazardous chemicals is not *pending* a lead-exposure answer; the question does not apply to it.
Returning them as blocked puts them back in the queue the moment anything else changes. A
chemical-industry reader sees this instantly; a test counting payload length does not.

### Case C — changing an answer you already gave

```
POST /api/switches/answer  { hazardous_chemicals_present, true }
POST /api/switches/answer  { hazardous_chemicals_present, false }
select basis from company_switches where switch_id = 'hazardous_chemicals_present';
```

**Perfect:** `basis->>'previous_value'` is `'true'`, `basis->>'kind'` is `user_answer`, and
`basis->>'question'` holds the question as asked. **The previous value is a FIELD, not a
sentence** — so *"which switches did this customer change this week"* is a query (§49, §50).

**Wrong, and the second is worse:**

- No `previous_value`. A requirement list that moved has no explanation on the row, and a
  correction is indistinguishable from an unexplained change.
- **A later document overwrites it.** A person's answer is `user_locked` and no automatic pass
  may replace it — **and that is enforced in one library module and nowhere in the database.**
  Zero policies, zero constraints, zero triggers reference `user_locked` (check 24, `TODO.md`
  7.2c). **Until that trigger exists this case is the only thing standing between a stated fact
  and an inference**, so it is run after every change to any route that writes
  `company_switches`.

### Case D — a question that must never be asked

```
GET /api/switches/ask   → assert `hazwaste_generator_category` is absent
```

It is a monthly calculation, not a fact anyone holds. **Wrong:** it appears. A user asked to
state their generator category will guess, and a guess stored as `stated` with
`user_locked = true` outranks every later calculation.

---

## Manual set — Phase 4.3 (the obligation writer) and M6 (the requirements screen)

*HOW-WE-BUILD step 12. Written 13 September 2026, after both landed on staging and 022 landed on
production.*

> ### THE VISUAL HALF IS NO LONGER DEFERRED.
>
> 7.2a's set above is API-and-state only, and says so, because the screen did not exist. **It does
> now.** Each case below that carries a **`SEE`** block is the half that was owed. They are written
> here rather than merged into 7.2a's section for the reason that section gives: the two halves
> fail for different reasons and get fixed in different files.

**Both fixtures are on staging. Confirm the dev server points at staging before starting** —
the two company names below do not exist on production (`CLAUDE.md` §3.8).

| Fixture | Facts | Entities | Obligations | Computed |
|---|---|---|---|---|
| **Test Alpha Chemical** | 16, all `user_set` | 2 | 221 open | yes |
| **Test Beta Cannabis** | 0 | 1 | 1 open, hand-seeded | **never** |

---

### Case E — the first GET writes the list. THE ONE THAT MATTERS FOR 4.3.

> **⚠️ ORDER MATTERS, AND THE TRAP IS REAL: LOOKING IS WHAT FIRES IT.** The write happens on the
> first `GET /api/obligations`, so **step 1 must be run before anything opens the screen.** Open
> `/requirements` for Beta first and the before-state is gone, unrecoverably, and the case can
> only be run again by reverting `obligations_computed_at` to NULL by hand.

**Do this.** Log in as **Test Beta Cannabis** — the company that has never been computed.

```sql
-- 1. BEFORE. Run this FIRST.
select obligations_computed_at,
       (select count(*) from obligations o where o.company_id = c.id) as obligations
  from companies c where c.name = 'Test Beta Cannabis';
-- expect: NULL, 1
```

```
-- 2. Now open /requirements. Time it roughly — it computes inside the request.
```

```sql
-- 3. AFTER.
select status, count(*) from obligations
 where company_id = (select id from companies where name = 'Test Beta Cannabis')
   and applicable_to is null group by status;
```

**Perfect — five assertions:**

1. `obligations_computed_at` is **no longer NULL**.
2. The page returned in a few seconds, not a minute. **Alpha's 221 took 1.95 s across 2 entities**
   (`DECISIONS.md` §62). Beta has one entity and should be faster. **If this feels like a wait
   rather than a page load, that is the reversal condition in §62 arriving — report the number.**
3. **Reload the page. The counts do not change and nothing is re-opened:**
   ```sql
   select count(*) from obligations
    where company_id = (…) and applicable_to = current_date;   -- the closures from this reload
   ```
   A second run must report `opened: 0, unchanged: N`. **If the numbers grow on every reload,
   `close_and_replace_obligations` is inserting rather than matching**, and every refresh is
   quietly doubling a customer's compliance record.
4. **A cannabis company must not receive Oregon chemical-manufacturing rows.** Jurisdiction and
   industry are both part of the match key (`CLAUDE.md` §3.2), and this is the fixture that can
   catch it, because Alpha cannot:
   ```sql
   select count(*) from obligations o join requirement_templates r on r.id = o.requirement_template_id
    where o.company_id = (…) and not ('cannabis' = any(r.industries));   -- expect 0
   ```
5. **`resolved_by` is `computed_by_code` on every row.** Never `ai`. One query settles it, and it
   is the §3.2 line the whole architecture rests on:
   ```sql
   select resolved_by, count(*) from obligations where company_id = (…) group by 1;
   ```

**`SEE` — the screen, same interaction:** three section headings with **no counts in them**, a
coverage strip stating what is verified and what is not, and — because Beta has answered nothing —
**the questions section is the largest.** If `applies` is the largest section for a company with
zero recorded facts, something is asserting obligations from no evidence.

| Symptom | Cause |
|---|---|
| `computed_at` set, obligations still 1 | The write ran and wrote nothing. Beta's industry has no library rows — a real, reportable coverage gap, not a bug. Check `industry_coverage` before filing it |
| Counts grow on every reload | The uniqueness index is not matching. §16's `UNIQUE … NULLS NOT DISTINCT` is what makes a NULL `entity_id` collide with another NULL; if that index is gone, every reload duplicates |
| Any row with `resolved_by = 'ai'` | **Stop and report.** Layer 3 is code. This is the one failure in this file that is not a bug but an architectural breach |
| Chemical requirements on a cannabis company | The match key lost industry or jurisdiction. Silent and dangerous — §3.2 names it explicitly |

---

### Case F — the pre-existing obligation must be CLOSED, never deleted

**Why this case exists.** Beta carries **one obligation that predates the writer** — *"Adverse-reaction
allegation records"*, `status = applies`, `resolution_rationale` NULL, seeded by hand. The lazy
write in Case E runs `close_and_replace_obligations` over it. **This is the only fixture in the
project where a hand-made row meets the writer**, and it tests the property the product is sold on:

> *"We were subject to this from March 2024 to January 2026"* is the history the product exists to
> preserve. **Obligations are marked, never deleted** (`CLAUDE.md` §3.2).

**Do this.** After Case E, against Beta:

```sql
select status, applicable_from, applicable_to, resolution_rationale
  from obligations o join requirement_templates r on r.id = o.requirement_template_id
 where o.company_id = (…) and r.requirement_name = 'Adverse-reaction allegation records';
```

**Perfect — the row is STILL THERE.** Exactly one of two shapes, and both are correct:

- **Superseded** — two rows: the old one with `applicable_to = today`, and a new open one.
- **Closed** — one row with `applicable_to = today` and no replacement, because the requirement
  is not in Beta's resolved set.

**Wrong — and this one is silent:** the query returns **zero rows.** The history was destroyed and
nothing anywhere records that it existed. **There is no DELETE policy on `obligations` and the
function contains no DELETE**, so a zero here means something outside both is removing rows and
must be found before anything else ships.

---

### Case G — every claim on the screen traces to a fact, and `does_not_apply` names it

**Do this.** Log in as **Test Alpha Chemical** and open `/requirements`. Open the
**`does_not_apply`** section and read ten rows.

**Perfect.** Every one reads in this shape, with a real switch name and a real value:

```
Ruled out by: industrial_stormwater = false.
Ruled out by: hazwaste_generator_category = vsqg.
Ruled out by: air_permit_required = none.
```

**39 of 39 do this today.** The assertion is not "most of them" — **it is every one**, because a
`does_not_apply` with no named fact is the one thing §3.2 forbids outright: a clear produced by
absence of evidence rather than by contradicting evidence.

```sql
-- the machine-checkable half of the same assertion
select count(*) from obligations
 where company_id = (…) and status = 'does_not_apply' and applicable_to is null
   and resolution_rationale !~ '^Ruled out by: [a-z_]+ = ';   -- expect 0
```

**And the domain half, which is the part no query can do.** Pick the three rows whose switch you
know best and ask: **is that fact actually sufficient to rule that requirement out?**
`industrial_stormwater = false` removing a DEQ 1200-Z obligation is right. The same fact removing a
spill-response requirement would be wrong, and would look identical on screen. **This is the
case where domain knowledge does work no script replicates** — it is the reason the manual set
exists at all.

| Symptom | Cause |
|---|---|
| A row says only *"does not apply"* with no fact | The rationale is being generated instead of composed. §3.2's rule is that the evidence is **recorded**, not described |
| A rationale names a switch that is not in the list of 95 | The trigger references a fact the library does not carry. That is audit check 19, and it is a library defect surfacing as a screen symptom |
| A fact rules out something it should not | **The most valuable failure in this file.** Nothing automated can find it. Report the requirement and the switch — the fix is in `applies_expression`, not in code |

---

### Case H — the twelve rows waiting on quantities, and the button behind them

**Why this case exists.** It shipped wrong twice in two days, both times found by looking at the
screen and by nothing else (`DECISIONS.md` §61, audit check 26). **`resolve()` was correct both
times.**

**Do this.** As Alpha, open the questions section and find the rows for **DEA List I chemical
registration**, **PSM — management of change**, **EPCRA emergency-planning notification**.

**Perfect — three assertions, all visual:**

1. Each says **"Waiting on your chemical inventory — we need the quantities you keep on site, not
   just the safety data sheets."**
2. Its button says **"Add your chemical inventory"**, not "Answer the question".
3. **Scroll the whole questions section: no row anywhere says "we cannot say yet" and then stops.**
   Every one names something. `124 + 12 = 136`, and the third bucket is empty.

**Why the wording is worth reading rather than skimming.** A customer who uploads their entire SDS
binder and sees nothing move concludes the product is broken. **The sentence exists to say the
upload was not wasted and a different thing is needed** — quantities are not in an SDS. If it
reads as a complaint about their file, it is wrong (§5.1).

| Symptom | Cause |
|---|---|
| A row says "Waiting on:" with nothing after it | `factsNeeded` is empty and `inventoryNeeded` is not being read. This is the exact defect of 13 Sep, returned |
| Those rows offer "Answer the question" | The action is fixed by status again rather than chosen from what is missing |
| A row names neither | **The interesting one.** A requirement's trigger names a fact that is in no question list and no inventory list — a library gap, not a screen bug. Report the requirement name |

---

### Case I — the empty state, which is TWO claims and only one of them can be true

**Why this case exists.** `renderEmptyState()` took no argument until 13 Sep and always said *"we
have not worked out your requirements yet."* That was true while nothing wrote obligations. **After
4.3 it is false for the case that matters**: a company whose resolution genuinely produces nothing
would be told nothing had been computed. §5.1 — an empty state is a claim and it has to be true.

**Do this.** There is no fixture for the second state, and **making one is the point of the case**:

```sql
-- a company that has been computed and resolved to nothing.
-- Create it on STAGING ONLY, by signing up a business in an industry with no library rows.
select industry, jurisdiction, status from industry_coverage order by status;
```

**Perfect:**

- A company **never computed** reads *"We have not worked out your requirements yet. This is not a
  result."*
- A company **computed with zero rows** reads *"We worked out your requirements and found none that
  apply to you. That is a result… please tell us if it looks wrong."*
- **Neither ever reads as a clean bill of health.** No "compliant", no "all set", no "no action
  needed". The omniscient status tracker is a named anti-pattern here and was removed once already
  (`CLAUDE.md` §6).

**And the invitation to disagree is not politeness.** Zero applicable requirements for a real
manufacturer is far more likely to be our coverage gap than their good fortune, and the sentence
has to make that easy to say.

---

### ⛔ CASE A HAS A DEFECT IN ITS OWN PRECONDITION — 15 September 2026

**Case A's precondition is *"a company with nothing established"*. Its assertion is *"the
obligation count moves"*. Those cannot both hold.**

Run for the first time on **Test Gamma Solvents** — chemical-manufacturing, Oregon, zero facts,
created 15 Sep because neither existing fixture matched (Alpha had already answered
`has_employees`; Beta matches zero library rows):

```
BEFORE: facts 0 · obligations 0 {}
POST { has_employees, true }   as testgamma@example.com, 0.5s
  obligations AFTER : 200  {"unknown":178,"applies":21,"undetermined":1}
  persisted         : {"closed":0,"opened":200,"received":200,"unchanged":0,"open_total":200}
  UNBLOCKED (one level, §54): 7
  ask: READY 43 -> 49 · BLOCKED 38 -> 31
```

> **On a company with no obligations, one answer does not MOVE a count — it CREATES the list.**
> `opened: 200, unchanged: 0, closed: 0`. There is no before to differ from, so **the case cannot
> observe the thing it was written to observe.**

**Two numbers, and they must not be conflated:**

| | |
|---|---|
| **21 of 200 created** | the **fresh-company** figure. Measured 15 Sep. First measurement of anything here |
| **a genuine delta** | **does not exist yet.** No measurement has ever shown `closed`/`opened` against a non-empty baseline |

**Neither replaces 19 or 23**, and neither of those was ever a measurement: 19 is this case's own
expectation, written before the endpoints existed; 23 appears in no artifact at all
(`DECISIONS.md` §65, seventh instance).

**THE FIX IS TO THE CASE.** A case testing *"what does one answer move"* needs a company that
**already has obligations**. **Test Gamma is now that company** — it has been computed once — so
the case is runnable in its intended form on the **next** answer, not this one. Case A should be
split:

- **A1 — the first answer.** Precondition: nothing established. Asserts **creation** — a list
  comes into existence, `opened = N`, `closed = 0`, and `unblocked` is non-empty.
- **A2 — a subsequent answer.** Precondition: obligations already computed. Asserts **movement** —
  `closed` and `opened` both non-zero against a known baseline.

### RESULT — RUN, 13 September 2026, in a browser, by a person

> **This set is recorded as RUN, not as written.** The distinction is the point of the file: a
> manual set that has never been executed is a plan, exactly as an audit check with no recorded
> answer is a plan (`AUDIT-CHECKS.md`). **Two of the five found something no automated check
> could, on the first attempt.**

**What it found, and neither was predicted:**

**1. Case E crashed on its first fixture.** `/api/obligations` returned **500 in 645 ms** for the
first non-chemical company the writer had ever seen. The route connects as the caller;
`close_and_replace_obligations` and `substance_inventory` were `service_role`-only, so the first
write was refused by Postgres. **It had never run through its own route** — Phase 4.3's 1.95 s and
221 obligations were measured by a script holding the service-role key, which set
`obligations_computed_at` and made every later request skip the write. **On production that was
all ten companies.** Fixed by migration 023. `DECISIONS.md` §63.

**2. Case G's domain half surfaced two library-quality shapes.** Ten minutes of reading the
rendered rows found three kinds of wrong rule that 199 expression reviews had not, and the sweep
it prompted found **22 of 216 switch clauses that can never be true** — a large-quantity generator
receives **zero** hazardous-waste obligations and is told so in a confident sentence.
`DECISIONS.md` §64, `AUDIT-CHECKS.md` check 28, work is `TODO.md` 6.4c.

**Neither is reachable by any automated check**, and both were found on the first run. That is the
argument for this file, demonstrated rather than asserted.

### RESULT — first run, 13 September 2026

**Cases E, F, G and I: PASS, functionally.** Run in the browser against staging by the owner,
after migration 023.

| Case | Result |
|---|---|
| **E** — first GET writes the list | **pass** — the write fired on first GET, the reload was idempotent |
| **F** — pre-existing obligation closed, never deleted | **pass** — the seeded row was **closed**, not removed |
| **G** — every claim traces to a fact | **pass mechanically** — every `does_not_apply` names a switch and a value, with a correction affordance. **See below for the domain half** |
| **I** — the empty state is two claims | **pass** — both sentences render correctly |
| **H** — the twelve inventory rows | not re-run; last measured 124 / 12 / 0 on Alpha |

**Case F, proved in the data rather than on screen.** Beta after the run: **open 0, closed 1.**
The hand-seeded *"Adverse-reaction allegation records"* row carries `applicable_to`, not deletion.
And Beta resolves to **zero** obligations — all 200 live library rows are
`chemical-manufacturing` — so Case I's second sentence, *"we worked it out and found none that
apply"*, **rendered for the first time.** It had never been reachable before 023, because the
route returned 500 before it could be shown.

**Case E found the 500 that migration 023 fixed** — on its first run, its first fixture, against
the first non-chemical company the writer had ever seen (`DECISIONS.md` §63).

> ### AND CASE G's SECOND HALF DID EXACTLY WHAT IT WAS WRITTEN TO DO.
>
> The case says: *"this is the case where domain knowledge does work no script replicates."*
> **Ten minutes of reading the rendered rows found three shapes of wrong rule that 199 expression
> reviews had not**, and the sweep it prompted found that **22 of 216 switch clauses can never be
> true** — a large-quantity generator receives zero hazardous-waste obligations and is told so
> confidently. `DECISIONS.md` §64, `AUDIT-CHECKS.md` check 28, and the work is `TODO.md` 6.4c.
>
> **This is the argument for the manual set, demonstrated rather than asserted.** Every automated
> check passed. The mechanism was correct at every layer. What was wrong was a claim about the
> world, and the only instrument that detects that is a person who knows the subject, reading a
> sentence the product actually said.

### What none of these five can tell you

- **Whether the requirement rows themselves are right.** Every case above tests that the machinery
  resolves, persists and renders correctly. **`verified_at` is set on 0 of 205 requirement
  templates and `source_checked_at` on 0** — so a perfectly-resolved obligation may still point at
  a rule that misstates the law. The coverage strip says this on every screen; these cases do not
  test it and cannot.
- **Whether the switch values are true.** 16 facts, all `user_set`. If a customer answers wrongly,
  everything downstream is confidently wrong and every case here still passes.
- **What happens at scale.** 2 entities, 221 obligations. §62's reversal condition is about a
  company with many more.
- **Anything about production.** No production company has computed obligations
  (`obligations_computed_at` is NULL for all 10). Every case here runs on staging.

---

## Golden document cases — specified, blocked on one decision

`docs/SWITCH-DETERMINATION.md` §6 has the full shape. Summarised here because this is where
someone looks for what a test is:

```
tests/golden-documents/<case>/
  source.pdf          the document, committed
  extracted.txt       the text the pipeline produced, FROZEN
  expected.json       human-written once, never regenerated
```

Four assertions, **the first two needing no AI**: `basis` is a literal substring of
`extracted.txt` · `must_not_determine` has no hits · `must_determine` matches on switch, value
and class · `max_determinations` caps enthusiasm.

**⛔ Not built, and the blocker is a decision rather than effort.** A case needs a committed
document, and the only realistic candidates are production files belonging to test companies —
including `HF_Acid_SDS_2024.pdf`, whose review is a complete FMLA analysis with a headcount of
42 and which would be the strongest negative control available. **Whether customer-uploaded
files may enter the repository is not a decision to take quietly**, so the directory does not
exist yet. Synthetic documents are the safe alternative and prove less.

---

## Proving the tests can fail — `npm run mutation`

Added 12 September 2026, with the first test suite in the codebase.

**`HOW-WE-BUILD.md` §3: a validator that has only ever said PASS is untested.** That applies
to a test suite more than to anything else it was written about, because every property this
suite guards **fails silently** — a wrong answer is a requirement quietly leaving a customer's
list, not an error anyone sees. A green suite is not evidence that the properties hold. It is
consistent with the tests asserting nothing at all.

`npm run mutation` breaks the engine nine ways, runs the suite against each, records which
tests caught it, restores the file and verifies it byte-identical. **Each mutation is a
plausible implementation, not obvious junk** — the comparison inverted, the default flipped, a
guard dropped. The shapes a reviewer reads past.

| # | Property | What a wrong implementation looks like | Caught by |
|---|---|---|---|
| 1 | `unknown` never becomes `does_not_apply` | `verdict === true ? applies : does_not_apply` — one line, typechecks, every unanswered requirement leaves the list | **6** |
| 2 | `not(unknown)` is `unknown` | `return !v`. Reads correctly in English; `!'unknown'` is `false` | **3** |
| 3 | `any_of(false, unknown)` is `unknown` | Dropping the unknown check — equivalent to `||` with a coercion | **12** |
| 4 | `all_of(true, unknown)` is `unknown` | The mirror. Over-includes rather than clears, so less dangerous — still asserts what nobody said | **12** |
| 5 | A NULL expression is `undetermined`, never skipped | `if (!expr) continue` — the most natural line anyone would write | **2** |
| 6 | Jurisdiction is decided **before** the expression | Treating out-of-jurisdiction as unproven rather than contradicted. §24's incident: fewer rows and a 200 | **2** |
| 7 | A fact counts only when it is **readable** | `return t === 'true'`. Turns every unreadable answer into a confident FALSE | **2** |
| 8 | A company-level expression is evaluated across **all** sites | Evaluating the primary site only. Cheaper, obvious, and wrong at five of six facilities — `DECISIONS.md` §20 | **5** |
| 9 | `determined_by` names the facts that are missing | Leaving the array empty. Every status stays correct; the ask list silently becomes nothing | **2** |

**All nine caught, 12 Sep 2026. Baseline and post-run both 119/119.**

**It is NOT in `npm run check`, on purpose.** It edits source files and runs the suite ten
times; a gate that rewrites the working tree is a gate nobody will trust under a git conflict.
**Run it whenever the evaluator, the resolver or the jurisdiction predicate changes** — and
treat a surviving mutation as a failing build, because that property is untested whatever the
suite says.

**Two mutations are worth reading even if you never run it.** #4 is the only one that errs
toward over-inclusion, which is why it is listed below #3 despite failing the same number of
tests — direction matters more than count. And #9 breaks nothing a user would see: every
status stays correct, and the only casualty is the answer to *"what would we have to ask"*.
That is the shape of defect this file exists for.

---

## The expression layer is a new class of invariant

Added 12 September 2026, with Phase 6.3. **These are not tests of code and not tests of a
model — they are tests of a body of data, and they fail in a way no type-checker and no build
can see.** A condition that names a switch nobody defined is still valid JSON, still loads,
and still evaluates: it just evaluates to `unknown` forever, so the requirement it guards
becomes permanently unanswerable and nothing anywhere reports an error.

They belong here and in `AUDIT-CHECKS.md` (checks 19–21) for different reasons: **the loader
enforces them at write time, and the audit checks ask whether they are still true afterwards.**
A row can be edited in the database without going through the loader; the second question is
not the first question asked twice.

| Invariant | Why a violation is silent | Enforced where |
|---|---|---|
| **Every switch id named by a condition exists** | An unknown switch has no value, so the clause is `unknown`; `unknown AND true = unknown` and the requirement never resolves either way. No error, no log, no failed query. | `load-expressions.js` refuses the file · `AUDIT-CHECKS.md` check 19 |
| **Every CAS in a company's inventory is in `regulated_substances`** | A CAS matching nothing used to make `substance_inventory()` return `false` — a clear, produced by not looking. Migration 014 makes it `unknown` instead. The invariant now guards the *data quality* question rather than the safety one. | FK `company_chemicals.cas_number → regulated_substances` · migration 014's own semantics · check 20 |
| **No threshold appears that is absent from the rule's own text, in that unit** | A number that looks authoritative and is not. The one that shipped came from a *neighbouring* rule, so it was real, correctly typed, and wrong for this requirement. | `load-expressions.js` warns per row · `DECISIONS.md` §44 · check 21 |

**The manual test for this layer is not a click — it is a read.** `npm run expressions` prints
every non-high-confidence condition as an English sentence next to the rule's own trigger
prose. **The test is: does the sentence say what the prose says?** Two people can do this
without a database. It is the only test in this file that a domain expert can run better than
an engineer, which is exactly `HOW-WE-BUILD.md` §1's argument for keeping the roles apart.

**Two known-failing cases to keep visible rather than fix quietly:**
1. `NSPS/NESHAP/MACT applicability screen` **under-triggers** — gated on holding an air permit,
   and an unpermitted source can still be subject. This is the one that fails in the dangerous
   direction. `TODO.md` 6.4a.
2. `Employee handbook, current version controlled` has **no condition at all** and is live. Any
   test asserting "every live requirement has a condition" must expect 199, not 200, until
   `TODO.md` 6.4c decides whether a best-practice row belongs in a legal library.
**Related:** `AUDIT-CHECKS.md` · `HOW-WE-BUILD.md` §2 · `TODO.md` 2.8 · `CLAUDE.md` §3.10

---

## Why this file exists

Three different things get called "testing" here and they answer three different questions.
Conflating them is how a product ends up with a green build and a wrong answer.

| | Question | Who runs it | What it can conclude |
|---|---|---|---|
| **(a) Manual** | Is the right answer also a **convincing** one? | The owner, as a user | Anything — including things no script can see |
| **(b) Golden files** | Did the answer **change**? | CI, after any prompt/model/matching change | Only that output moved, and where |
| **(c) Unattended** | Is the system **self-consistent**? | An overnight agent | Consistency and shape. **Never truth.** |

`npm run check` is none of these. It answers *"does the code compile, pass its unit tests and
build"*. `AUDIT-CHECKS.md` is a fourth thing again — *"is the data behind the answers in a
state we would defend"*.

---

# (a) MANUAL — what the owner does as a user

**Two per feature, always, and the second one is the one that matters.**

**The perfect case.** Everything present, nothing missing, the happy path. It is not asking
*"is the answer correct"* — code review and golden files cover that. It is asking **"is the
right answer also a convincing one?"** A technically correct answer that a plant manager
would not act on has failed. Does it say which regulator, which document, what to do next?
Would somebody being inspected next week feel helped or hedged at?

**The edge case.** A missing document. An expired permit. Two handbooks that contradict each
other. A switch nobody has set. **Does the product say so, or does it paper over?** This is
where `CLAUDE.md` §5.1 and §6 are actually enforced — the rule that the product never asserts
anything about a document it did not read, and that `unknown` stays `unknown`.

**The edge case is where domain knowledge does work no script replicates.** A test script
knows whether a field is null. It does not know that a combination package's inner bottles
are not separately labelled, that an Oregon customer must be shown OAR 437 rather than 29
CFR, or that "we're below the Tier II threshold" does not answer the Oregon CR2K question.
Those errors are fluent, confident and invisible to every automated check on this page. They
are visible to somebody who has been inspected.

### This is a standing obligation, not a suggestion

**Every major piece of work ends with a short numbered list of things to click and ask** —
added to this file, in the same session, before the commit. It is step 12 of
`HOW-WE-BUILD.md` §2's loop.

Two per feature. Numbered. Specific enough to follow without thinking: which page, what to
type, what should come back. "Check the agency stuff works" is not a test.

---

# (b) AUTOMATED REGRESSION — the golden-file set

**`npm run golden`. Built 11 September 2026; `TODO.md` 2.8. Cases live in `tests/golden/`.**

**Status, 12 September: three cases, two of them exercising the determination gate.** 001 (the
2.5L bottle) proves it asks; 003 (Oregon minimum wage) proves it does **not** ask when the
facts are there; 002 predates the gate and is skipped by the runner with a reason rather than
counted as a pass.

**Run after every prompt change, model upgrade, temperature change, or change to requirements
matching** — i.e. everything in `CLAUDE.md` §3.1. Those are precisely the changes whose
effects are invisible in a diff.

**What a golden file is:** a saved question, the full response, the model and temperature, and
a `system_prompt_sha256` so a prompt edit is detectable rather than deniable. Plus `expected`
facts, each labelled by how well it is known — `primary-source-retrieved` or `unverified`.

**What it concludes: only that the output moved, and where.** A golden file cannot tell you
the new answer is worse. A human reads the diff. That is the point — it makes change
*visible*, which is the thing prompt work otherwise lacks entirely.

**The runner exists as of 11 September: `npm run golden`.** It reads every case in
`tests/golden/`, runs it against staging, and reports per-assertion PASS / FAIL / HUMAN / SKIP.
Three things about it are deliberate:

- **It rebuilds the gate prompt from `lib/determinationGate.ts` rather than holding a copy.**
  A copy would drift, and the drift would be silent because the tests would keep passing
  against the stale copy.
- **An assertion with no checker reports SKIP, never PASS.** A runner that silently passed
  what it could not check would be worse than no runner — `AUDIT-CHECKS.md`'s standard.
- **Assertions a script cannot judge report HUMAN** — "does it say Nevada and Pennsylvania are
  not covered" is read by a person, not matched by a regex.

The `system_prompt_sha256` in each case is a tripwire: when the prompt changes, the run says
so loudly and tells you every stored expectation was written against the old one. *(Proven by
falsifying a recorded hash and confirming it fired, then restoring it.)*

**Four verdicts, and three of them are not "pass".** `PASS` · `FAIL` · **`HUMAN`** for an
assertion a script cannot judge — *"does it say Nevada and Pennsylvania are not covered"* —
and **`SKIP`** for one with no checker implemented. **A SKIP is never reported as a pass**, and
the run says how many there were: a suite that silently passed what it could not check would
be the worst version of this file.

### An assertion class, not a case: thresholds must be quoted, not derived

*Added 12 September 2026. `DECISIONS.md` §44.*

**Any number in an `applies_expression` must appear in that requirement's own
`trigger_condition` or `citation`, in that unit.** If it does not, the expression is asserting
a number nobody wrote down.

This is a **class** rather than a case: it runs over every expression rather than over one
input, and it needs no model call. `thresholdsIn()` in `lib/appliesExpression.ts` returns every
numeric literal an expression asserts; comparing that list against the row's own text is a
string search.

**Two ways it fails, and the second is the one a reviewer cannot see:**

- **A unit conversion.** A threshold written in pounds restated in gallons requires assuming a
  density, and density belongs to a product rather than to a rule.
- **A number imported from a neighbouring rule.** Caught on the first run: **1,320** appeared
  in `Oil Facility Response Plan determination`, a real figure from 40 CFR 112.1 belonging to
  the **SPCC Plan** row. Correct about the world, wrong about the rule.

**It runs in `npm run check`, not in `npm run golden`** — it asserts a property of the library
rather than of an answer, so it belongs with the static checks and costs nothing to run.

**It grows by one entry per failure found.** Every real-world wrong answer becomes a case, so
the same mistake cannot return quietly. Case 001 is the **2.5L bottle** — the original
failure, where the model enumerated past a missing packing group and attached $650–1,800 of
costs to a requirement that did not exist as stated. Case 002 is DOT shipping for isopropyl
alcohol drums, with two of seven facts checked against live eCFR text.

---

## Case 001 — three assertions, not one
*Spec extended 11 September 2026. The file is not written yet; `tests/golden/` holds only 002.*

**The shipment is Reno to Philadelphia. That is entirely federal.** DOT hazmat is 49 CFR and
applies in every state, so **the only library rows in scope are PHMSA's 15 and FMCSA's 7** —
22 of 200 live rows. *(Re-measured 12 Sep: PHMSA 15, FMCSA 7, unchanged by migration 013's
splits, which touched OSHA and confined-space rows only. The denominator moved 192 → 200.)* The company is Oregon-based, and for this question **its jurisdiction is
irrelevant**: the goods never touch Oregon.

**Assertion 1 — the original one.** The gate asks for the SDS instead of enumerating past the
missing packing group. Packing group determines UN number, hazard class, limited-quantity
eligibility, packaging spec and label — five of the six things that went wrong.

**Assertion 2 — NEW. The answer must not draw on any Oregon agency.**

If Stage 2 returns all 31 Oregon-chemical agencies and the determination gate starts asking
Oregon OSHA questions about a Nevada-to-Pennsylvania shipment, **that is the same failure as
serving Oregon requirements to a Texas company, arriving from the other direction.** §3.2's
rule — *jurisdiction is always part of the match key* — is usually read as "do not under-serve
by getting the state wrong". This is the over-serving face of it: the state is right about the
company and wrong about the question, and the result is a plant manager working through
Oregon heat-illness and wildfire-smoke obligations before shipping a box.

**The check:**

```sql
-- Oregon-agency rows that a correct answer to case 001 must NOT cite.
select t.requirement_name, a.short_name
  from public.requirement_templates t join public.agencies a on a.id = t.agency_id
 where a.jurisdiction_level in ('state', 'county', 'city', 'local')
   and t.effective_to is null;          -- 91 rows today: 88 Oregon state, 3 Oregon local
```

**Assertion 3 — NEW. The answer must state that origin and destination state requirements are
not covered.**

**Neither Nevada nor Pennsylvania is in the library.** It holds 94 live Oregon rows and 98
federal ones, and nothing else. So the honest answer covers the federal rules **and says
plainly that state requirements at origin and destination are not covered.**

That is the coverage strip doing its job on a question where **the gap is real**, rather than
implying completeness by silence. An answer that gives the 49 CFR obligations and stops,
saying nothing about Nevada or Pennsylvania, reads as complete and is not — and it fails
`CLAUDE.md` §6 in the quietest available way, by omission rather than by assertion.

### Why this is 2.1 paying off in a way nobody planned

**Assertion 2 was unfalsifiable four days ago and is a `WHERE` clause today.**

Before Part C, every requirement had `agency_id = NULL`. "The answer drew on Oregon material
it should not have" was a judgement somebody had to make by reading the output and
recognising the content — which means it was only catchable by someone who already knew the
Oregon library well enough to spot a row from it. There was no column to test.

`agency_id` was assigned to serve Stage 2's scoping — bounding what the model is asked to
enumerate. It turns out to also make **the negative case checkable**: not "did the right rows
appear" but **"did the wrong ones stay out"**, which is the harder half and the one that
degrades silently. The same column answers both, and only one of them was the reason for
building it.

The general shape is worth keeping: **a structural column added for retrieval usually makes
some previously-editorial assertion mechanical.** It is the argument for finishing 6.5a — the
six empty agencies — ahead of things that look more visible.

### One document disagrees, and it is worth reading before writing the file

`CHEMICAL-OR-WA.md` §5.2, describing Stage 2 for this exact question, says:

> *"For the shipping question: DOT/PHMSA (transport), OSHA/state plan (workplace labeling),
> FMCSA (own fleet), and possibly the state fire authority for storage before shipment."*

That names **a state plan and a state fire authority as in scope**, which reads as a
contradiction of assertion 2. **It is not, and the reconciliation is the useful part:** §5.2
is written generically, and the state plan it means is *the state where the work happens*. For
a shipment originating in Reno that is **Nevada's** programme, not Oregon's — and Nevada is
not in the library, which is assertion 3.

So the precise rule is not "no workplace regime is in scope for a shipping question". It is
**"no *Oregon* agency is in scope for a shipment that never enters Oregon."** If case 001 is
ever rewritten as an Oregon-origin shipment, assertion 2 inverts and Oregon OSHA becomes
required rather than forbidden. **Write the case with the origin stated explicitly**, because
the assertion depends entirely on it.

---

# (c) UNATTENDED EXPLORATION — the overnight agent

Not built. **The boundary below is the whole design**, because it is what decides whether an
overnight run is useful or dangerous.

### It CAN

- **Run the golden files** and report which moved.
- **Run the audit sweep continuously** — every check in `AUDIT-CHECKS.md`, on a schedule,
  against staging. **Check 13 (the switch dependency graph) is the best-shaped one for this**:
  it needs no regulatory knowledge, it has a single correct answer, and the failure it detects
  is invisible to every other tool.
- **Property-test for CONSISTENCY without knowing the truth.** This is the largest and least
  obvious category, and it needs no regulatory knowledge at all:
  - the same question twice → the same answer
  - the same question phrased two ways → the same answer
  - **one fact changed → only the parts that depend on it move.** Change the state and the
    federal obligations should be identical. Change the employee count and the transport
    answer should not budge. A diff that spreads beyond the dependency is a finding.
  - a determination resolved → the requirements gated on it change, and nothing else does
- **Adversarially probe the known failure shapes** and confirm the product **asks** rather
  than guesses: a missing determination (does Stage 1 request the SDS?), an unreadable
  document (does it say it could not read it, per §5.1?), an unset switch (does it stay
  `unknown`?), expired evidence (does it refuse to satisfy?).

### It CANNOT

**Validate regulatory content. Not partly, not with a confidence score, not "flagging items
for review".**

An overnight run reporting *"194 requirements verified"* would be the **omniscient status
tracker in a lab coat** — the named anti-pattern of this project (`CLAUDE.md` §6), arriving
with a timestamp and a progress bar to make it look like process. A model checking another
model's regulatory output produces agreement, and agreement is not verification.

**Verification is the human step and stays one.** `AUDIT-CHECKS.md` check 1 is the reason,
and it is not an abstraction: **0 of 200 live rows carry a `citation_url`, a `citation_quote`, or a
`source_checked_at`, and 0 are at `status = 'verified'`** — re-measured 12 Sep, and the
numerators did not move when the denominator went 194 → 200, because splitting a row cannot
give it a source its parent never had.** There is no artifact behind any of
them. An agent has nothing to check *against* — which is `CLAUDE.md` §3.3 exactly: excellent
against an artifact, unreliable from nothing. The overnight agent is the unanchored case by
construction.

What it may do at the edge of this line: **retrieve** a primary source and report that the
text does not contain what the row claims. That is retrieval, not judgement, and the output
is a queue for a person — never a `verified` flag.

### The question-7 input varies run to run, and that is a consistency probe waiting to happen

*Recorded 12 September 2026. Noted, not solved.*

The determination gate returns `non_blocking_unknowns`, and Stage 5's question 7 — *"does any
statement assume a fact the user did not provide?"* — checks the answer against it. **On the
same question, the same case and the same temperature, that list came back with three entries,
then two, then zero.**

**A critic asserting against a list that varies run to run is asserting against something
unstable.** It is not wrong on any single run; it is differently right each time, which is
harder to notice and harder to test. Whether this matters depends on how much weight question
7 ends up carrying — on the 2.5L artifact the critic found the unstated assumptions from the
answer text alone, without needing the list.

**This is (c)'s probe, not a bug report:** ask the same question twice and compare the
declared unknowns. Both answers cannot be right about what was left open.

### Why consistency testing earns its place here specifically

**The engine has a known consistency problem, and it is now measured rather than recalled.**
Readiness numbers differed between runs — recorded in the original diligence, before this
rebuild. **`baseline-outputs/audits.json` holds the evidence**: six audits of **ISO 9001:2015,
the same 272-item standard, the same company, across two days.**

| | satisfied | needs_info | needs_work | distinct documents cited |
|---|---|---|---|---|
| 24 Jul 16:17 | **6** | 49 | 217 | 11 |
| 24 Jul 16:45 | 9 | 54 | 209 | 16 |
| 24 Jul 17:26 | 7 | 26 | 239 | 15 |
| 25 Jul 16:57 | 15 | 74 | 183 | 18 |
| 25 Jul 17:03 | 13 | 68 | 191 | 19 |
| 25 Jul 17:04 | **21** | 69 | 182 | 19 |

**A 3.5× spread on the headline number, and 219 of 272 items citing no document at all in the
worst run.** Both cannot be right, and saying so needs no knowledge of ISO 9001 — which is
exactly why this class of test can run unattended. That is a system giving two answers
to one question, which needs no domain knowledge to detect and no regulatory truth to
adjudicate: **both answers cannot be right, and finding that costs nothing but machine
time.** `CLAUDE.md` §3.2 requires resolution to be deterministic — same inputs, identical
output, every time — so consistency testing is the direct check on a stated safety property,
and it is the one class of overnight work with no way to produce a false clean.

*(That finding predates this repository's documents and is carried in from the owner's
original diligence rather than read from the code. It should be re-measured against the
resolution engine once Phase 4.1 exists, and recorded here with a date.)*

---

# MANUAL TEST SET — 2.2, the determination gate
*Written 11 September 2026, the day it landed. `HOW-WE-BUILD.md` §2 step 12.*

**Unlike 2.1, this one you can see.** The gate runs on every `/api/chat` and `/api/audits`
request, and when it stops, a card appears where the answer would have been.

**Before you start:** confirm the dev server points at **staging** — you should be able to
sign in as *Test Alpha Chemical* (Hillsboro, Oregon) or *Test Beta Cannabis* (Portland).
`/api/chat` now requires a login, so a signed-out tab gets a 401 rather than an answer, and
that is the fix working rather than a bug.

### 1. The perfect case — does it ask, and is the question a good trade?

1. Sign in as **Test Alpha Chemical**. Go to `/compliance`, *Create* tab.
2. Ask, verbatim: **"We ship isopropyl alcohol from our Reno warehouse to a customer in
   Philadelphia, six 2.5L bottles to a case. What is the minimum labelling requirement for
   the bottles and for the case?"**
3. **Expected: an amber card, no checklist.** It should ask about the concentration or the
   packing group, offer to take the SDS, and list what that unlocks.
4. **The convincing test, not the correct one:** read the card as somebody with a shipment
   going out tomorrow. Does it read as a **trade** — *give me this, get those five things* —
   or as an obstacle? If the `unlocks` list is vague ("a more accurate answer"), the question
   is not earning itself.
5. **Type an answer in the box** — `II` — and send. You should get a checklist, not the same
   question again.
6. **Then upload an SDS instead** (`tests/golden/` case 002 has the text of one). The fact
   should now come from the document rather than from you.

### 2. The edge case — what the card looks like when it is WRONG

These are the four failure shapes. Each is worth deliberately provoking once.

1. **It asks twice for the same thing.** Answer the question, and if the same card comes
   back, that is the infinite-ask bug — **the one failure worse than a wrong answer**. The
   suppression rule in `lib/determinationGate.ts` is supposed to make this impossible; if you
   see it, stop and report it rather than working around it.
2. **It asks something it already knows.** Ask **"what minimum wage do we pay at our
   Hillsboro plant?"** If it asks where your site is, the gate has lost sight of `entities`
   (`DECISIONS.md` §35.2). It should answer.
3. **It asks three questions in one.** Read the question text: "What is the packing group,
   and do you use your own vehicles, and how many employees do you have?" is one `ask` object
   carrying three questions in a sentence. The schema caps the object, not the prose.
4. **It hedges in a checklist.** If a checklist step says *"if packing group II, order these;
   if III, order those"*, the gate let something through it should have asked about. The
   schema has no field for that, so it would arrive inside a `description` string.

### 3. The edge case with no gate opinion — an industry we have not built

**This is the one that is easy to miss, because everything on screen looks fine.**

1. Sign in as **Test Beta Cannabis**.
2. Ask anything real — **"what do we need in place to store and use butane for extraction?"**
3. **Expect a clean gate and a confident answer.** The gate will probably proceed: it knows
   the worksite is Portland, Oregon, and nothing about the question is missing a *company*
   fact.
4. **And the answer is unanchored.** All 25 of the cannabis coverage rows are at
   `row_count = 0`. **There is not one library row behind that answer** — it is the free
   enumeration mode `CLAUDE.md` §3.3 names as known-bad, and the gate has no opinion about it
   whatsoever.

**The two questions are different, and 2.2 only answers the first:**

| | Question | Answered by | State today |
|---|---|---|---|
| **About YOU** | do we know enough about this company and this shipment? | **the determination gate** (2.2) | ✅ built |
| **About YOUR INDUSTRY** | do we know enough about this vertical to answer at all? | **`industry_coverage`** (2.1) + the coverage strip (M6) | data exists, **nothing renders it** |

A gate that passes cleanly means *"nothing about you is missing"*. It does **not** mean
*"this answer is anchored"*. Those are answered by different tables, and today only one of
them is wired to anything. **Until the coverage strip exists, a confident cannabis answer is
indistinguishable on screen from a confident chemical one**, and only the second has 187
requirements behind it.

Repeat step 2 as **Test Alpha Chemical** — same gate behaviour, 187 rows behind it instead of
zero, and **nothing on the screen tells you which you are looking at.** That difference is
what M6 has to make visible, and noticing it is the point of this test.

### 4. The proceed path, which is easy to forget to check

Ask three ordinary questions in a row as Test Alpha Chemical and count how many produce a
card. **If it is more than one, the gate is asking too much** — and that failure is invisible
one answer at a time, because each question looks justified on its own
(`DETERMINATION-GATE.md` §7). It is also the direction that loses users: people abandon a
product that interrogates them, and they do not file a bug first.

### What none of these can tell you

Whether the gate asked for the **right** fact. It asks one question confidently either way,
and a plausible wrong question — asking about employee count for a shipping question — reads
exactly like a good one. `tests/golden/` case 003 covers the specific case where employee
count must not block; everything else is judgement.

---

# MANUAL TEST SET — 2.1, the agency list
*Written 11 September 2026, the day it landed on both environments.*

**Read this first: 2.1 built a spine, not a screen.** 33 agencies, 187 assignments and 56
coverage rows are all in the database and **nothing renders them.** `grep` finds no reader
for `agencies` or `industry_coverage` outside the loaders. So tests 1–2 are about whether the
foundation is real, and 3–4 are what to look for the moment M6 or the Workspace starts
displaying it.

**A test that "passes" today by showing nothing is not a pass — it is confirmation that the
UI work has not started.** That distinction is the point of writing these now.

### 1. The perfect case — does a company get the right regulators?

1. Confirm the dev server points at **staging** (`CLAUDE.md` §3.8 — staging company names
   differ from production's; you should see *Test Alpha Chemical* and *Test Beta Cannabis*).
2. Sign in as the chemical company. Ask the Workspace: **"Which agencies regulate my
   facility?"**
3. **Expected, once anything reads the table:** 33 agencies — 14 federal, 16 Oregon, 3 local.
   Oregon OSHA must be there. Federal OSHA may be, as baseline, but the answer must say
   **Oregon OSHA enforces**.
4. **The convincing test, not the correct one:** does the answer name the regulator in the
   words a plant manager uses — *"the DEQ inspection"*, *"the fire marshal visit"* — or does
   it list slugs? Does it say what each one wants from you?
5. **The one to watch for:** if the answer cites **29 CFR** to this Oregon company for a
   workplace-safety obligation, that is the §1.2 failure in production. The library still
   holds 49 rows whose `citation` is the federal analogue; the assignment is right and the
   *displayed citation* is not (`AUDIT-CHECKS.md` check 2).

### 2. The edge case — does it admit what it does not have?

1. As the chemical company, ask something that lands on an **empty** agency:
   **"What do I owe the Oregon Department of Revenue?"**
2. **`OR-DOR` is in scope and has ZERO requirements behind it.** The honest answer is *"Revenue
   regulates you and we have not built that coverage yet"*. The failure is a confident answer
   assembled from model memory with no library row behind it — §3.3's unanchored mode, which
   is exactly what the coverage strip exists to prevent.
3. Repeat as the **cannabis** company with anything at all. **All 25 of its coverage rows are
   at 0.** Every answer it gives today is unanchored. Does the product say so?
4. Ask about the **Corporate Activity Tax** specifically. If a confident answer comes back
   with a threshold and a filing date, that is a fabricated specific: it is not in the
   library, so it came from the model, and §6 says a number like that must carry a
   verification badge.
5. **Then ask the same two questions twice, in different words.** Any difference between the
   answers is a finding on its own (see (c) above) and needs no regulatory knowledge to call.

### 3. The edge case that has no UI yet — the coverage strip

The strip described in `CLAUDE.md` §6 —
`OSHA ✓verified · DEQ ✓verified · Local fire ◐partial · ODA ○not built` — **does not exist.**
When it is built, the manual test is:

1. **Every one of the 56 rows must render as `not built`.** Not one is `generated` or
   `verified`, because no requirement in the library has been checked against a source.
2. **The 32 empty rows must be visible**, not filtered out. A strip that shows only the
   agencies with content is the omniscient status tracker with a display filter.
3. `OR-OSHA` must read **53**, not 54 — the retired silica parent is excluded
   (`AUDIT-CHECKS.md` check 4).

### 4. The edge case to try the day requirements render — split rows

1. Find the **silica** requirement for the chemical company. There are **five** rows: one
   retired parent and four live children.
2. **The customer must see four, not five.** If the retired parent appears, a superseded rule
   is being shown alongside its replacements and the customer cannot tell they are the same
   obligation.
3. Same shape for the **boiler** requirement: one retired parent, two live children, **two**
   shown.

### What none of these four can tell you

Whether the 187 assignments are **right**. A requirement filed under the wrong agency renders
perfectly, counts correctly and reads normally — `DECISIONS.md` §33 records six that nearly
were. The only defences are the mapping table being readable by a person and the projection
being read by target before it was applied. **No manual test recovers that**, which is why
the review happened before the write rather than after.

---

## Documents — the scan on the upload path (Run 3, commit 1)

Two tests, the perfect case and the edge case, and the edge case is the one worth your
time: **a file the product cannot read must say so, in its own words, on the row.** The
audit engine used to drop such a file with a console line and compute readiness from the
rest; the whole point of `could_not_read` as a status is that it cannot be dropped.

Both are run signed in, against staging, on `/documents`.

### 1. The perfect case — a single PDF uploads, scans, and lands with a status

1. **Add files**, pick `tests/golden/documents/fixtures/02-acdp-chemical.pdf`, upload.
2. While it runs the row's status word must move **Queued → Reading… → a real word**. It
   must not sit on Queued and it must not jump straight to the end: `/api/document-scan`
   sets `documents.status = 'reading'` *before* the model call precisely so the row is
   honest while the work is in flight.
3. When it settles the row must read **Expiring** in amber with **Expires 15 November
   2026** under it — that permit's own date, 51 days out at the time of writing, and the
   90-day window is computed in SQL by `document_index_v`, not by the page.
4. The title on the row must be the scan's — **"Standard Air Contaminant Discharge
   Permit"** — not `02-acdp-chemical.pdf`. The filename belongs on the meta line.
5. **One** `ai_calls` row must appear with task `document_scan`:
   `npm run cost -- --since <today>`. Two would mean the old date-extraction call is still
   firing; zero would mean the scan never ran and the status word is a lie.

### 2. The edge case — an unreadable file lands as could_not_read, with its reason

Take any PDF the parser cannot turn into a document block — `tests/fixtures/`'s blurred
page is the one to hand — or rename a `.zip` to `.pdf`, which is faster and tests the same
branch.

1. Upload it. The upload itself **must succeed**: the file is stored and the row exists.
   A reading we could not produce is not a reason to lose somebody's file.
2. The row must read **Could not read** in amber, and under it **the reason in plain
   words**, saying it is our problem and what would fix it. If it says nothing, or says
   something about the document's contents, that is the §5.1 failure this status exists to
   end — nothing may be asserted about a document that was never read.
3. The page must not show an error banner and the network tab must show **200**, not 500.
   `/api/document-scan` returns a reading, and "we could not read it" is a reading.
4. `documents.status` in the database must be `could_not_read` — not `reading`. A row
   stuck on `reading` is a page that spins forever.

### What neither of these can tell you

Whether the reading is **right**. Both tests pass on a scan that identifies the permit as a
handbook, dates it wrongly and invents its conditions — the row renders, the status
computes and the cost row is written. That is what the golden documents are for
(`npm run golden:docs`), and even they only say the output moved.

---

## Documents — the page (Run 3, commit 2)

Four tests. The first is the perfect case; the other three are the ones that catch the
failure this page is built to avoid — **a row disappearing because it has no value in the
column you grouped by.** A list that silently drops what it cannot classify is the
omniscient status tracker with a display filter on it, and it looks completely correct.

Run signed in, against staging, on `/documents`, with the seven golden fixtures uploaded
through the page itself (`tests/golden/documents/fixtures/`).

### 1. The perfect case — Group by Status puts the seven fixtures in the right groups

With Group by on **Status** (the default), the seven land as:

| group | which fixtures | why |
|---|---|---|
| Needs work | `01-eap-chemical`, `04-fsp-food` | the scan returned `gaps_found` |
| Expiring within 90 days | `02-acdp-chemical` | a permit whose own date is 15 Nov 2026 |
| Current | `03-olcc-cannabis` | a licence, and its date is March 2027 |
| Recorded | `06a`, `06b` | records |
| On file | `05-sds-supplier` | somebody else's document |

1. The group **order** must be Needs work, Expiring, Expired, Could not read, Not yet read,
   Current, Recorded, On file — the operator's question, not the alphabet. An empty group
   is not shown; a group with rows in it is never skipped.
2. Amber on Needs work, Expiring, Expired and Could not read; **grey on everything else.**
   If Current or Recorded is coloured, the one green/amber rule has been broken and the
   colour has stopped meaning attention.
3. Each row's title is the scan's, not the filename. The filename is on the meta line.

### 2. Group by Agency — a document with two agencies appears under both

`04-fsp-food` comes back with **FDA** and **Oregon Department of Agriculture**.

1. Switch Group by to **Agency**. That one document must appear **under both headings**.
   A row is not assigned to one agency; it has agencies, and each is a way of finding it.
2. The two rows are the same document: expanding either shows the same summary.
3. Counts beside the group headings therefore do **not** sum to the number of documents,
   and that is correct. If you ever want them to, the grouping has been made exclusive and
   the second agency has been thrown away.

### 3. The edge case — an unread document appears in "No agency yet", not nowhere

1. Upload any file and, **while it is still reading**, switch Group by to **Agency**.
2. The uploading document has no agency yet. It must appear under a last group headed
   **"No agency yet"** — never dropped, never silently filtered.
3. The same holds for Subject, Kind and Site ("No subject yet", "No kind yet", "No site
   yet") and for Folder ("Not in a folder"). The empty group is always last and always
   present when it has rows.
4. Its status word reads **Reading…** while the scan is in flight and **Queued** if the
   page was reloaded and this browser is no longer the one scanning it.

### 4. Folder narrows, and Group by still applies on top

1. Make a folder from the **Folder** dropdown. Move two documents into it with **Move to…**
   on a row's expanded area.
2. Pick that folder in **Folder**. The list must show only those two — and must **still be
   grouped** by whatever Group by says.
3. Folder rows and agency rows must never appear in the same list. If selecting a folder
   changed the grouping, or if a folder heading appeared next to an agency heading, the two
   controls have been mixed and the same file will be shown twice.
4. **Connect your drive** is greyed and does nothing. It is in the menu because the shape of
   the page is the promise; it is inert because it is not built.

### What none of these four can tell you

Whether the **reading** behind a row is right. Every one of these passes on a scan that
identified the permit as a handbook: the row renders, the group is computed from what the
scan said, and the colour is correct for a status that is wrong. `npm run golden:docs` is
the test for that, and even it only says the output moved.

---

## Documents — the report drawer (Run 4)

Nine tests. The first three are the perfect cases — a program, a permit, and a document
we could not read. The other six are the ones worth your time, because each is a place
where the product either keeps what a person told it or quietly loses it, and losing it
looks identical to working.

Run signed in, against staging, on `/documents`, with the seven golden fixtures uploaded
through the page.

### 1. The program drawer — 01-eap-chemical

Click the row. The drawer must show, in order: **Status** (Needs work, with the gap count
and `Revised 1 February 2021`), **What this says** in the serif, **the freshness nudge** in
amber wash saying how many years old it is with *Add a newer version* and *This is the
latest*, **What this document is** as two columns with a page reference beside any field
the scan gave one for, **Gaps** numbered with description, fix, citation and locator,
**Dates this document sets**, **Facts we found**, **Versions** if there is a chain, and the
quiet last line naming the model and the source count.

The date must read **Revised February 2021**, not a renewal date. Before Run 4 it read
*Renewal 1 January 2026* — a date that appears nowhere in the document — because the model
chose which date mattered. `chooseSignificantDate` chooses it now.

### 2. The permit drawer — 02-acdp-chemical

1. **Deadlines** must list the renewal and the expiry with their source lines, and a past
   non-recurring one must read **Passed** in amber.
2. **Conditions to keep** must be there with their condition numbers.
3. **There must be no Gaps section at all** — not an empty one. A permit is the agency's
   document; an empty "Gaps" heading says we judged it and found it clean, which is not
   what happened.

### 3. The could_not_read drawer

Upload a file that is not a readable PDF. Its drawer must show **the reason, the way
forward, and "Upload a clearer copy"** — and nothing else. No empty identity table, no
zero-gap heading. Eight blank sections assert that we looked; we did not.

### 4. "Not right" on a gap survives a reload and lowers the count

1. On 01's drawer, click **Not right** on a gap. Save must stay disabled until a reason is
   typed — the sentence is what the next scan is shown, and an empty one teaches it nothing.
2. Save. The gap moves under **Dismissed** with the reason beneath it, struck through.
3. Reload. It is still dismissed, still showing the reason, and the row's gap count in the
   Status line is **one lower**. A dismissed gap that still counts keeps a document in
   Needs work forever.

### 5. Add to calendar

1. On a deadline with a date, click **Add to calendar**.
2. The line changes to **In your calendar** at once, and still says so after a reload.
3. In `/calendar` the event is there, and its `document_id` names this document. A calendar
   event that cannot say which document set it is a date nobody can check.

### 6. Read it again

1. Note the current reading. Click **Read it again** in the footer.
2. A **second** `document_scans` row appears. The first keeps all of its data and its
   `is_current` becomes false — nothing is overwritten, because what the model said on a
   given day is the evidence.
3. The drawer shows the new one when it returns.

### 7. A correction changes the row and the drawer at once, and survives a re-scan

1. On 01, **Not right? Change what this is** → set Kind from Policy to Program. Save.
2. The drawer shows Program immediately; close it and the **row** shows Program too.
3. **Read it again.** The correction must still win — the view prefers it over whatever the
   new scan says, and the next scan is told about it so it does not repeat the mistake.
   If a re-scan can undo a person, the correction was never worth offering.

### 8. "This is the latest" hides the nudge, and stays hidden

1. On 01, click **This is the latest** in the amber nudge.
2. The nudge goes. Reload: it is still gone. `latest_confirmed_at` is a timestamp, not a
   boolean, because null means nobody has answered — which is not the same as "no".

### 9. Download prints the drawer, not the page

**Download** in the footer. The print preview must show the drawer as an ordinary document
with a header carrying **company, title and date**, and none of the page behind it, no
scrim, no close button, no footer buttons. A printed compliance page with no company and
no date is not evidence of anything.

### What none of these nine can tell you

Whether the **reading** is right. Every one passes on a drawer that renders a wrong kind,
an invented citation and a date read off the wrong line perfectly. `npm run golden:docs` is
the test for that, and even it only says the output moved.

---

## Documents — what a person does with a report (Run 5)

Ten tests. Four of them are about a model call and cost money; the other six are free.
The ones worth your time are the last three, because each is a place where a thing a
person did could quietly be lost — a checklist orphaned by a re-scan, a fact confirmed in
one screen and still pending in another, a draft silently replaced under their cursor.

Run signed in, against staging, on `/documents` with the seven golden fixtures uploaded.

### 1. A checklist from one gap

Open 01-eap-chemical, click **Make a checklist** on a gap. The gap then shows
**"<title> · checklist made <date> · 0 of N done"**, linking to the checklist. Open it: it
says where it came from, and the items read as things to do on a Tuesday — "Write the
missing reporting procedure", not "Ensure compliance with 1910.38". Tick one item and
reopen the report: the line reads **1 of N done**, because the progress is read live off
the items rather than stored.

### 2. A checklist for all the gaps

**Make a checklist for all N gaps** — the drawer's one outlined button. The result has one
section per open gap, each item naming the gap it came from. A dismissed gap must not
appear: it is closed, and making work out of it would undo the dismissal.

### 3. A draft under a draftable gap

On a gap the scan marked `draftable`, **Draft this section**. The draft appears under the
gap in the serif, above the line saying nothing has been written into your file.

**Read it for the blanks.** Anything only you have — a name, a phone number, a headcount —
must appear as `[name of the plan coordinator]`, not as a plausible invention. A draft that
has quietly filled in a coordinator's name is the failure this test exists to catch, because
nobody would know to check it.

Then confirm the file is untouched: **Open the file** in the footer and read it. The draft
is not in it and never will be.

### 4. A second draft replaces the first and says so

**Draft it again** on the same gap. The new text replaces the old, and a line at the top of
the drawer reads **"This draft replaced the one that was here before."** Swapping the text
silently under somebody half way through copying it is the thing this prevents.

### 5. Research this

**Research this** on a gap opens the Compliance Workspace with the composer already holding
the gap's title and fix, and the document attached below it. Send it: the answer must show
the document was carried. Reload the workspace afterwards — the composer must **not**
re-fill, because the parameters are consumed on arrival.

### 6. To confirm shows the count and the three

The sidebar reads **To confirm** with a count. The page shows **three at a time** with
*Show more*, and a line stating the order: *"Ranked by what each answer unblocks: the ones
we can say something about first, then what we read in a document, then the newest."*
Check the order matches: a proposal with an "affects" line above one without; a document
proposal above a conversation one; newest first within that.

### 7. Confirm a fact whose key names a switch

Find a proposal whose line ends *"answers one of the questions we ask about your company"*.
Confirm it. The message reads **"Confirmed, and recorded against the question it answers."**
In the database, `company_switches` has the row and `switch_determinations` has the
determination behind it — written by `/api/switches/answer`, the same path a person
answering in the workspace uses, not a second copy of it.

### 8. Confirm a fact whose key names nothing

Confirm one without that line. `company_facts` gets one row carrying the proposal and the
document it came from. Confirm a **different** proposal with the same key: there is still
one row, now holding the newer value — one answer per question, not a history nobody can
resolve at read time.

Open the report drawer for that document: the fact reads **Confirmed** there too.

### 9. Not right, with a reason, in either place

Reject a proposal from the To confirm page with a reason. Open the document's drawer: it
reads **"Not right — you said: …"**. Do the reverse — reject from the drawer, then load To
confirm — and it is gone from the queue. One row, two doors.

### 10. A re-scan keeps a gap's checklist when the gap comes back

With a checklist on a gap of 01, click **Read it again**.

- **When the new scan raises the same gap** — matched on its title, case-insensitively, or
  on its citation — the checklist link appears on the new gap, with its progress intact.
- **When it does not** the checklist is not orphaned: the old gap is still on the report
  under **From earlier readings**, with its checklist and progress, so the work somebody
  did survives a reading that changed its mind.

Check both. The second is the one that matters, because a model that renames a gap between
runs is not an edge case — Documents Run 2 measured exactly that.

### What none of these ten can tell you

Whether the checklist is the *right* work, or the draft is text a regulator would accept.
Both are a model's output against a gap that was itself a model's output. The golden
documents test the reading; nothing here tests the advice, and nothing yet does.

---

## Documents — closing what Run 5 exposed (Run 6)

Six tests. Two of them cost a model call; the rest are free. The one worth doing first is the
fourth, because it is the only one that can tell you whether a person's work survives the
product changing its mind about a document.

Run signed in, against staging, with the golden fixtures uploaded to the Cascade company.

### 1. A PDF's facts carry a verdict; a photograph's still do not

Re-read `01-eap-chemical.pdf` from the drawer. Open the report and look at the facts: each one
that carries a quote now reads **these words are in the file** or **quote not found in the file**.
Before Run 6 every one of them said neither, on every document, because the text a quote is
checked against was built from the parser's text blocks and a PDF has none.

Then open `06b-forklift-log-photo.pdf`, the same page as a photograph. Its facts show **neither**
line, and that is the pass. There is no text in a photograph to check against, and saying "not
found in the file" about a file we could not read the words of would be an accusation we cannot
support. Null is not false.

Check `document_scans.extracted_text` for both: text for the first, null for the second.

### 2. A file attached in the workspace scans through the new path

Attach a document in the Compliance Workspace. The card underneath it reads
**Read as: &lt;kind&gt; — &lt;title&gt;**, then the agency and the status, then the scan's summary —
all of it off `document_index_v`, the same row the Documents page shows.

**Now open the Documents page without re-scanning anything.** The file is there, read, with the
same kind, the same agency and the same status word. That is the test: until Run 6 the attach
flow used a reading nothing else could see, so the conversation card said it had read the file
while the Documents page showed it as Queued for ever.

Attach something unreadable too — a photograph of a wall, or a `.zip` renamed to `.pdf`. The card
says what we could not do and what would fix it, in the scan's own words, and the file is still
saved and still attached to the conversation.

### 3. A fact proposed by two documents is one question

Find a key two documents propose — `facility_address` on the Cascade fixtures does it. In
**To confirm** it appears **once**, with both documents listed under it and the quote each one
came from. The line above the queue says how many readings sit behind the three on screen.

One **Confirm** settles it: `company_facts` gets one row, and **both** proposals read accepted.
Reload — the key is gone from the queue, not showing again with its second source.

Then the disagreement. Make two sources say different things (correct one, or scan a document
that states another figure). The key shows **the sources do not agree**, there is no plain
Confirm button, and instead there is one button per value. Pick one: that value is stored and
every proposal for the key is settled. The product must never choose here on its own — not by
recency, not by the longer quote.

### 4. A re-scan carries a checklist to the gap the model named as the same

Make a checklist from a gap on `01-eap-chemical.pdf`, tick an item, then **Read it again**.

- Where the new scan **named** the old gap in `same_as_gap_id`, the checklist is on the new gap
  with its progress intact, and the old row reads `status = 'superseded'` with `superseded_by`
  pointing at its replacement.
- Where it named nothing and the titles do not match either, the old gap stays **open** and
  still carries its checklist, and the report lists it under **From earlier readings**.

Both are correct outcomes. What must never happen is the third one: the old gap closed with its
checklist left pointing at it. Check `open_gap_count` on the row afterwards — before Run 6 it
counted every gap from every reading, so a twice-read document showed more open gaps than it has.

### 5. The expected line appears under one grouping and nowhere else

On Documents, **Group by: Agency**. Under at least one agency there is an amber-wash line
beginning **"What we'd expect and don't see:"** and ending **"Based on what similar companies
hold, not on a checked requirement."**

Now switch to Kind, Site, Folder, Status and None. The line is **gone** from all of them. It is a
claim about a regulator's usual paperwork; under any other grouping it would be a different
sentence, and a false one.

An agency whose scans proposed nothing shows no line at all — not an empty one, and not "nothing
expected", which would be a claim.

### 6. The site filter narrows, and keeps what belongs to everybody

With two sites on the company, the **Site** control appears. Choose one: the list narrows to that
site's documents **plus every company-wide document** — the handbook, the corporate policy, the
SDS. Those have no `entity_id`, and they belong to every site rather than to none.

Correct a document's site in the drawer's correction form and the filter follows it immediately,
because `document_index_v` reads the correction rather than the scan.

The control is absent entirely for a company with one site: a filter with one option is a control
that cannot do anything.

### What none of these six can tell you

Whether a quote the check verified is being used to support the thing it is quoted for, or
whether the expected-and-don't-see list is the right list. Both are a model's judgement about a
document, and the verification here is mechanical: these tests say the machinery carries the
answer, never that the answer is good.

### 7. Delete a document that has a checklist

Open a document you made a checklist from. In the drawer footer, **Delete this file** —
faint, 12px, the quietest thing there, because it is the only irreversible action on this
screen. It asks first, and the question says what survives:

> **Delete this file and its reading?**
> Checklists made from it stay, with their link to it removed.

Confirm. The drawer closes and the row is gone from the list.

**Now open the checklist.** It is still there, it still has its items and its progress, and it
no longer names a document. That is the test — the sentence in the dialog is a promise, and
the schema is what keeps it: `checklists.document_id`, `calendar_events.document_id` and
`company_facts.source_document_id` are `on delete set null`, while the scans, gaps, deadlines,
conditions and proposals cascade away with the file.

Check the bucket too: the stored file is gone, and the path deleted came off the row the
server had already proved was yours, never off the request.

### 8. The headings, on both screens

On Documents, group by **Agency** — the headings are the darker grey of body text. Same for
Subject, Kind, Site and Folder. Switch to **Status**: they go light again, because the rows
underneath already carry that word in their own right-hand column.

In the drawer, every heading that names a part of the report is dark — *What this document is,
Gaps, Dates this document sets, Conditions to keep, Facts we found, Versions* — and **Status**
is the one that stays light. All of them are the same 12px uppercase: the difference is weight,
not a second heading style.

### 9. No row carries a form control

On Documents, look down the list under any grouping. There is **no dropdown on any row** —
"Move to…" is gone. The rows are three columns: what it is, what it answers to, where it
stands.

Filing now lives once, in the drawer: **Filed in ▾** under the title. Change it there and the
list reflects it when the drawer closes. It does not print — where a document is filed is not
part of the evidence.

---

## Documents — a folder, a sweep, an email (Run 7)

Seven tests, plus Run 6's addendum four above. Two of them cost real money; the rest are free.
The ones worth your time are the third and fourth, because both are about what happens when
something goes wrong in the middle of work nobody is watching.

Run signed in, against staging, with `NOTIFY_TEST_TO` set so the email reaches you.

### 1. Two files are read while you watch, and no email arrives

Add two files from the Documents page. They scan one after another in the page, exactly as
before — `Reading 1 of 2`, then `Reading 2 of 2` — and the rows fill in as each returns.

When the second returns, the banner appears at the top: **"We've read your 2 documents"** with
the counts and the titles behind them. **No email.** Somebody who watched the files go in does
not need to be told by email that they went in. Check `document_batches`: `status = done`,
`done_count = 2`, `summary` populated, `notified_at` **null**.

Dismiss the banner. Reload — it stays gone, because the dismissal is a row and not browser
state.

### 2. Eight files go to the background

Add eight (the seven fixtures plus one). The page says **"8 files uploaded — reading them in the
background"** and returns immediately; every row says **Queued**.

Now watch without touching anything. Rows turn **Queued → Reading… → their status**, roughly one
every minute, because the page polls the index every ten seconds while anything is in flight and
the sweep reads them one after another. **Close the tab half way through and reopen it** — the
remaining files still get read. That is the whole reason four is the threshold.

When the last one lands the banner appears with the counts, and **the email arrives**. Read it:
every line in it is a row you can find on the page. Subject `We've read your 8 documents`. Record
the Resend id from the sweep's response. `notified_at` is set, and a second sweep does not send
it again.

### 3. One document throwing does not stop the sweep

Queue several documents and make one of them fail — the quickest honest way is to delete the
stored file out of the bucket while its row still says `uploaded`, which is a real failure the
product has to survive.

The sweep continues to the end. Check the `job_runs` row: `ok = true`, `counts` showing what was
read, and **`errors` naming that document by id**. A run that read seven of eight is a successful
run with one recorded error, not a failed sweep. The failed document reads `could_not_read` on
the page with a reason, never a blank row and never a silent omission.

### 4. Two companies are read company by company, never interleaved

Queue a batch for two different companies at once, then run the sweep.

Assert it from `document_scans.scanned_at`: order every scan by time and the company ids must
come out in **runs** — all of one company's, then all of the other's — never alternating. This
is not tidiness. Every scan is built from the readings before it, so a company's documents read
out of order see less than they should, and Run 6 measured what that produces: five different
key names for one address.

### 5. A re-scan withdraws a proposal the new reading does not restate

Note a pending fact on a document, then **Read it again**. If the new reading does not restate
that key, the proposal reads **"No longer proposed by the latest reading"** in the drawer and is
**gone from To confirm**.

It must **not** say "Not right". That is the person saying we were wrong, and it teaches the next
scan something. This is us saying the file no longer says it, which teaches nothing and is not
the person's fault. And the row is still there: a proposal that silently disappeared from the
queue is a change nobody can see.

A key the new reading restates with a **different value** must survive as a disagreement, not be
withdrawn — that is Run 6's two-values-one-key case, and withdrawing it would hide the change.

### 6. A gap the latest reading passed over stays open and says so

After a re-scan, look for a gap the new reading neither raised nor named in `same_as_gap_id`. It
appears under **From earlier readings** with:

> Not seen in the latest reading. Still open — we do not close a finding because a reading
> stopped mentioning it.

Check the row: `status` is still **open** and `not_seen_at` is set. The amber is deliberate: this
one asks something of a person, where a superseded gap in the same list does not.

### 7. The expected line truncates and expands

Group by Agency. A group whose scans proposed more than three entries shows the first three and
**"and N more"**. Click it: the rest appear in place, with **show fewer** to close it again. The
count is always visible — a truncation that hides how much it truncated is the product deciding
what you get to see.

### What none of these can tell you

Whether the sweep's ordering produced a *better* reading of document eight than reading it first
would have. The mechanism is testable and the benefit is not: it rests on the claim that a scan
shown the labels and keys already in use reuses them, and the only evidence for that is Run 6's
measurement of what happens when it is not shown them.
