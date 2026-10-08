# Test at the finish line

**Version:** 1 · **Updated:** 8 October 2026, the HR section's part written by the HR chat.
**Other sections:** add your own part below, in the same shape (A to J). Do not edit another section's part.

---

## What this file is

**The owner's decision, 8 October 2026.** The quality tests (the yardstick) run **once, at the end**, when every
section is built. A change to any section before then could make an earlier test stale, so testing earlier would
mean testing twice.

**Until then, each section keeps building as it does now.** The machinery is proved on Haiku: unit tests,
`check:live` on port 3999, staging proofs. Each section writes down here everything it is leaving for the finish line,
so nothing is forgotten and nothing is tested twice.

**The order at the finish line, for every section:**

1. **The free checks:** `npm run check`, and `check:live` on 3999.
2. **The machinery on the real model:** one Opus run per paid path, per section. This catches what only fails on
   Opus: refused shapes, longer answers, slower calls.
3. **The yardstick:** a baseline run of fixed cases, each with a written key, on Opus 5.5 at production settings.
4. **The switches,** each measured against that baseline, one at a time.
5. **The go-live** of each section still held behind a switch.
6. **The release:** the `docs/RELEASE.md` routine.
7. **The morning after:** the `job_runs` check, then each section's close-out.

**Rule for cross-section changes.** A section that changes a shared file before the finish line re-runs the free
checks of every section that uses it. Each section lists its shared files under its part's J.

---

## HR

### A. Where HR stands (8 October 2026)

- **Built through step 11a, released, behind `HR_PREVIEW`** (off on production). The new page is `/hr/new`, only
  where `HR_PREVIEW=1`. Old HR still serves at `/hr`.
- **Migrations 066 to 072** are on staging and production.
- **The record:** `docs/HR-PLAN.md` (v17), `DECISIONS.md` §164 to §179, and the HR manual sets in `docs/TESTING.md`.
- **The go-live happens now, not at the finish line** (the owner, 8 October 2026). The other sections are live
  without their yardstick, and holding HR would keep the old HR on production meanwhile, which never checks a quote
  or a link. So, before the finish line: the Opus machinery run (C), then the go-live (H), then the morning after (I).
- **Held for the finish line:** the yardstick (D, E), the manual sets (F) and every HR switch (G).

### B. Settings for every Opus run

Always on an **isolated server copy** (port 3998). `.env.local` is never changed for this.

| Setting | Value for the finish line | Why |
|---|---|---|
| `AI_MODEL_HR`, `AI_MODEL_HR_CHECK`, every `AI_MODEL_*` | `claude-opus-5-5` | As production |
| `AI_EFFORT` | `medium` | The laptop's `.env.local` says `low`; production is `medium` |
| `DEV_MAX_SEARCHES` | `0` in the server's own environment | The laptop sets `2`; `0` reads as no limit, as on production |
| `RESEARCH_PROVENANCE`, `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST` | `true` | Production's values, confirmed 8 October; HR's prompt is built from them |
| `HR_ANSWER_USES_CHECK` | unset (off) for the baseline | A switch, measured after the baseline |
| `AI_SEARCH_MAX_HR` | unset (no limit) | The yardstick decides whether to set one |
| `HR_HANDBOOK_BUDGET_TOKENS` | unset (the Opus default, 650,000) | Set small only to force the long-handbook path once (C) |
| `HR_PREVIEW` | `1` in the server's own environment | HR's routes are 404 without it |
| `NOTIFY_TEST_TO` | the test inbox | So the check's email goes to the test inbox |

**Prove the settings held, as on 8 October:**
- the cost ledger shows `claude-opus-5-5` at effort medium;
- a check's stored prompt fingerprint matches a dry run with all three research switches on;
- the server log names no search limit.

**Cost:** `npm run cost` before and after each part. The owner sets the budget before anything runs. At 8 October
prices: about $5 for C; about $20 for D and E, priced again from the real handbook's size first.

### C. The machinery on Opus (one run per paid path) — DONE 8 October 2026, before the go-live

**Run on staging, block B's settings proved held** (every task `claude-opus-5-5`; answers and checks at effort medium;
the check's prompt fingerprint matched the dry run; no search limit). **Nothing broke.** Ledger: $4.62, Opus only.
- **Worked:** a conversation with a follow-up, Stop (V-1), reopen with "Not answered." and Ask it again (V-3); the
  summary button, a fact proposed from "We have 12 employees in Oregon", Review → (V-4), Download the summary and
  Cancel (V-5); Check now with its progress line and the email; text first (a question while the 30-page PDF was
  read); the long-handbook path with a 30,000-token budget (the honest wait "0 of 2 parts done", the section choice,
  a check in two pieces with one part forced to fail from a script); a reading that fails part-way
  (`HR_TEST_OUTLINE_FAIL`); the 120-page PDF read in 6 parts (48 sections). A Word handbook is read in code, with no
  model call, so it has no Opus path.
- **Left for the finish line: V-2** (Try again after "This answer stopped early."). It needs a connection that drops
  mid-answer (`lib/answerStream.ts`). On the development server, stopping the server reloads the page and losing
  the browser's network did not cut the stream; no code was changed to force it.
- **Found:** a stopped or cut-off answer writes no ledger row though Anthropic bills its tokens (`HANDOFF-CODE.md` §7).
- **As first written, the list of paths:**

Not the yardstick: it only proves nothing breaks on the real model. The code does not change after the go-live, so
it is not run twice.

**Already run on Opus at production settings and recorded (`DECISIONS.md` §177):** twelve answers, two questions
three times each, with the stored-check switch off and on.

**Not re-run on Opus, on purpose:** the nightly summary job and the night queue. Both were proved on Haiku
(`DECISIONS.md` §178), neither depends on the model, and on Opus they would charge for every quiet conversation and
every due handbook on staging. The summary button below runs the same writer; Check now runs the same check.

**Still to run once on Opus:**

- **Reading:** a large PDF outlined in parts (the 120-page synthetic handbook), and a Word handbook; a reading that
  fails part-way (the test path `HR_TEST_OUTLINE_FAIL`, never on production).
- **Text first:** a question asked while a handbook is still being read.
- **The long-handbook path:** with a small `HR_HANDBOOK_BUDGET_TOKENS`, so the section-choosing call and the honest
  wait ("<n> of <m> parts done") each run once on Opus.
- **A conversation:** a follow-up that uses the history; Stop; reopen; "Not answered." with "Ask it again".
- **The summary:** "Summarise this conversation".
- **The handbook check:** Check now; a check in parts (small budget); the progress line; a part that fails (forced
  from a script, as in §174's proof d); the email when a check someone pressed finishes.
- **The five controls the click-through could not reach:** `docs/TESTING.md` V-1 to V-5 (Stop, Try again, Ask it
  again, Review →, Download the summary).

### D. The yardstick: setting it up

**The lesson from the build.** Every staging handbook so far belongs to another business: a restaurant's policy
loaded for a chemical company. So Opus spends its answer saying "this isn't your handbook". That is right of it, and
it means no answer so far measures HR on a handbook the company owns. The yardstick must use handbooks that fit the
company they are checked for.

- **The company:** Test Alpha Chemical (`testalpha@example.com`), sites Hillsboro and Portland, Oregon.
  - **Add a Washington site** (for example Vancouver), for the two-state case.
  - **Delete its mismatched handbooks** first (Harbor Kitchen twice, the Washington addendum), through the real
    delete route.
- **The handbooks, the owner's choice at the finish line:**
  - **Either** the owner's own company handbook, on staging only, never in the repository (recommended: real
    structure, real gaps, and the owner knows the right answers);
  - **or** a synthetic handbook written to fit Test Alpha, with planted gaps.
  - **Either way,** a short synthetic Washington addendum with planted gaps, for the two-state case.
  - Between them: at least one PDF and one Word file.
- **The questions:** about eight real ones the owner or his HR person have faced: sick time, final pay, overtime,
  breaks, leave, an employee working from another state.
- **The key, written before any run, one per question:**
  - what the handbook says (section and words);
  - the rule, and the agency page that publishes it (official);
  - the right answer, the gap, the fix;
  - what is still to confirm.
- **The check's key:** every planted gap, so a check is scored as found, missed or false.
- **Where it lives:** `tests/golden/hr/`, as Audits' `tests/golden/audits/`. Questions and keys only; a real handbook
  never enters the repository.
- **Runs:** each case three times, to see the spread, as Audits' golden runs do.

### E. The yardstick: what to judge

**Answers:**
- the right answer against the key; the gap named; the fix; anything uncertain kept under "to confirm", never stated
  more firmly than its evidence;
- **sources:** official agency pages first. When no official page covers a point, the answer says so (on Haiku it did
  not, §175). Count official and other per answer;
- **every figure** (a rate, a threshold, a dollar amount) traceable to a cited source. §177 records "an Oregon minimum
  wage with no source" in the 8 October Opus run; the figure was $16.80, in four stored answers from that run
  (18:33–18:39 UTC);
- **two states:** the right rule for each site;
- **handbook quotes:** each quoted passage from the handbook gets its card. Count how often the grey
  "(not a quote from your handbook)" lands on proposed wording or a quote of the law (§175);
- **no internal labels** ("H12") anywhere.

**The handbook check:**
- planted gaps found, missed, and false gaps;
- whether Opus answers the fixed question section by section without being told to (§175);
- its links come from its own search; official against other;
- **cost and time on the 120-page handbook,** sent whole in one call on Opus. This decides whether the "cheaper
  splitting" switch is needed.

**The summary:**
- **whether it cites handbook passages on Opus** (§172). If not, the ready fallback is code that attaches a checked
  handbook quote found in the same paragraph as an item's basis; the owner decides then;
- "Your situation" holds only what the person said about their business; when empty, the grey sentence (§173);
- "Still to confirm" written as plain questions, not instructions (a Haiku note, §173);
- facts proposed only from the person's own words, and they reach Company information labelled with the
  conversation's title.

**Cost and time,** per answer, check and summary: searches, tokens, seconds. This decides whether `AI_SEARCH_MAX_HR`
is set (`docs/RELEASE.md`: "the testing step decides").

### F. The manual sets in `docs/TESTING.md` (the owner, on Opus)

Every "Manual set — HR …" in `docs/TESTING.md`:
- Step 4 (the page shell), 5a (adding and keeping handbooks), 5b (reading), 6a (the first answer), 6b-1 to 6b-7,
  6c-1 to 6c-8, 7-1 to 7-9;
- 8-1 to 8-8 (the check engine), B-1 to B-7 (the baseline), E-1 to E-7 (the email), S-1 to S-6 (the stored-check
  switch), N-1 to N-7 (the night work), V-1 to V-5 (the unreached controls).

**Rows the baseline replaced (§175).** A row that describes the structured check (8-4, 8-5), the `[H…]` quote marker,
"(quote removed)", or the "Suggested wording" box (6c-6) describes behaviour that no longer exists. Mark it
superseded in `docs/TESTING.md`; do not run it.

### G. The switches, each measured against the baseline (after it)

In `docs/HR-PLAN.md`'s order. Each is off by default.
1. **Prompt caching** for the handbooks in the answer and the check. Cost only: it may go on once proven.
2. **Answers use the stored check** (`HR_ANSWER_USES_CHECK`, built, off, §177). On Opus, 8 October: question 1 used
   one search fewer and cost 28% less; question 2 cost about the same. Watch figures without a source, and the order
   checks go in (handbook order today, so the question's own handbook can be the one left out for budget).
3. **Cards for handbook words written without quotation marks.**
4. **The structured check:** the local branch `parked/hr-check-structured` (`391fd05`, never pushed): per-section
   words, "Not covered", "Still to confirm", the dates with "Add to calendar". The Dates tab returns with it.
5. **Suggested wording as a draft.**
6. **The quote-marker form.**

**Two more, proposed by the HR chat (8 October), not yet in HR-PLAN; for the owner's yes:**
- **Cheaper splitting or section choice for very large handbooks**, if E's 120-page check shows the cost needs it;
- **Sonnet 5.5 against Opus 5.5**, per task, by measurement.

### H. The go-live (HR-PLAN step 13) — BUILT 8 October 2026 (`804d85e`, `DECISIONS.md` §181)

Items 1 to 5 below are done: the owner added the two Vercel settings; the page is at `/hr`; old HR is retired; the
switch is gone; the crons were already in place. Item 6 is the release itself.

1. **Vercel:** add `AI_MODEL_HR` and `AI_MODEL_HR_CHECK` = `claude-opus-5-5`, visible.
2. **The page moves** from `/hr/new` to `/hr`. Change `HR_PAGE_PATH` (`lib/handbookCheckNotify.ts`) once; the
   email's link follows it.
3. **Retire old HR** (decision 15): the body of `app/hr/page.tsx`, `app/api/hr/route.ts`,
   `app/api/hr-audits/route.ts`, `prompts/hr.ts`. The `hr_audits` table stays (one production row). The two old
   handbooks stay in Company Documents as test data (decision 25).
4. **Remove `HR_PREVIEW`** (`lib/hrPreview.ts` and every route's check), with the tests that pin it. The `check:live`
   HR probes change from "404 while off" to the real answers.
5. **Already in place:** migrations 066 to 072 on production (`npm run preflight` should say 0 pending); the two HR
   cron entries in `vercel.json` (`handbook-queue` at 10:00 UTC, `handbook-checks` every 5 minutes), which start
   working once the switch is gone; the sidebar already points to `/hr`.
6. **The release routine** (`docs/RELEASE.md`), then the free live checks on `https://compliboard.vercel.app`: `/hr`
   opens the new page; the retired routes are gone. Then one paid check: one HR question on production, as CB-Test-3.

### I. The morning after (HR-PLAN step 14) — the morning after the go-live

- `job_runs`: the summary row after 10:00 UTC, now including HR conversations; the `handbook_checks` rows for the
  queue and the sweep; the delete row after 10:30 UTC.
- Write `HANDOFF-HR.md`; update `STATUS.md`'s HR row; close what is fixed in `HANDOFF-CODE.md` §7.

### J. Open items, and the shared files HR depends on

**Open items that touch testing (`HANDOFF-CODE.md` §7, OPEN):**
- a handbook file left in storage with no row if the tab closes between the upload and the row save;
- a summary's as-of date is UTC, while the print header is local;
- a heading can sit alone at the foot of a printed page in the shared summary report (workspace and HR);
- `anon` and `authenticated` may execute any new function by default;
- account export leaves out conversations (turns).

**Staging test data to clean before the yardstick:** the mismatched handbooks on Test Alpha and Test Gamma, and the
many build-test conversations.

**Shared files HR depends on.** A change to any of these before the finish line re-runs HR's free checks; a change to
the first two after HR's yardstick makes it stale:
- `prompts/checklist.ts` `buildSystemPrompt`: **HR's answer prompt is built from it**, so a change to the workspace's
  research prompt changes HR's answers;
- `prompts/summary-report.ts`: HR's summary prompt copies two of its paragraphs word for word (a test pins them);
- `lib/pipelineConfig.ts` (the research switches); `lib/ai.ts` (`citedPassages`, `searchLimit`);
- `lib/summaryReport.ts`, `lib/summaryWords.ts`, `lib/listWords.ts`, `lib/topicList.ts`, `lib/topicClaim.ts`
  (the 6-hour quiet rule), `lib/conversation.ts`;
- `lib/documentScan.ts` `normaliseForQuote`, `lib/howTo.ts` `findReturned` and `labelFor`;
- `components/AnswerBody.tsx`, `ReportView.tsx`, `ConversationList.tsx`, `Stages.tsx`, `stageWords.ts`,
  `Drawer.tsx` (`printDrawer`), `Sheet.tsx`, `Tabs.tsx`, `buttonStyles`; `lib/printFrame.ts` (through `Drawer.tsx`);
- `vercel.json` (the cron entries).

**So at the finish line, HR's yardstick runs after the workspace's last prompt change.**

---

<!-- Other sections: add your part below, in the same shape (A to J). -->
