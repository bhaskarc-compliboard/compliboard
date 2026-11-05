# Test at the finish line

**Version:** 11 · **Updated:** 4 November 2026: **question 2b answered on Haiku at E0c** — one quote per finding took the lost sections from 3 of 6 to 0 of 3 — and still counted on Opus, with what the sentence costs added to it. Version 10: 4 November 2026: **the audit's words updated at E0a** — two of its three questions changed because the owner's three sentences changed the defects, and a third was added about broken JSON, which is not about a word at all. Version 9: 4 November 2026: **the audit's words added** (Part E step E0) — the fifth word and the narrowing of `on_file` are measured on Haiku and carry two things only Opus can settle, both of them one prompt sentence. Version 8: 3 November 2026: **the Audits chat's part added** (A, D, E), by Part A step 6b. Its six keys were written from Cascade's own rows and committed before the first model call, and measured on `claude-sonnet-5-5` against the Documents brief on the same six questions. Version 7: 2 November 2026: **"Which model, per tier" added** as a shared item, by Part A step 4a-compare, with the Documents chat's question 2 on Sonnet 5.5 against Opus 5.5 as its first data point (`q2-A-1..3` against `q2-A-opus-1..3`). It gathers what HR's G, the Calendar's G and the Documents chat's D had each asked for separately. Version 6: 2 November 2026: **the Documents chat's part added** (A, D, E only — its page and routes are not built), by Part A step 4a-test. Its six keys were written from the readings before any run and have been measured on `claude-sonnet-5-5`, with and without everything the brief and the prompt give the model. Version 5: 19 October 2026: **the Calendar's part added** (A–J), by the Calendar chat at its close-out (`docs/CALENDAR-PLAN.md` step 15, `DECISIONS.md` §202). Version 4: 9 October 2026: HR H, the second paid check (§184). Version 3: 9 October 2026: HR I done (the morning after); HR B notes summaries' effort. Version 2: 8 October 2026, §183: HR H's paid check done; two things added to judge in HR E. Version 1: 8 October 2026, the HR section's part written by the HR chat.
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

## Which model, per tier — the comparison that runs across every section

*Added 2 November 2026 by Part A step 4a-compare, because three sections had each asked for it separately and
nobody owned it: HR's G (*"Sonnet 5.5 against Opus 5.5, per task, by measurement"*), the Calendar's G (*"`AI_MODEL_CALENDAR`
is Opus 5.5 today… worth one measured comparison"*) and the Documents chat's own D. One item, one method, one place
to put the numbers.*

**What it is not.** It is not a bake-off between models in the abstract, and it is not a cost exercise. It answers
one question per tier: **does the expensive model do something the cheap one does not, on this product's own
questions, against keys written before the run.**

**The method, in two steps and that order:**

1. **Quality first, on written keys.** Take the section's own yardstick scenarios (the `D` table in each part).
   Run the same question three times on each model, with everything the section gives the model and nothing
   changed between the two but the one `AI_MODEL_*` variable — set in the command's own environment, never in
   `.env.local`, and with every other tier on the Haiku id so nothing else is being paid for. Score against the
   key: facts hit, missed, **invented**; quotes shown and how many the check marked; every rule number written and
   **where each one came from**; documents named by title; searches.
2. **Then one hard question through the real app, on each model.** The keys are run through the probe, which is
   the engine and not the product. One question per model goes through the page, signed in, so the stream, the
   cards, the action row and the stored turn are all in it. **A model difference that only the probe can see is
   not yet a difference to the person.**

**The rule for reading the result.** A tie on the key is a result, not a failure of the test — it says the key
does not separate the two models and the tie-break has to be named out loud (hedging, dates carried, what the
person can click). **A cost ratio is only an argument once the quality question has an answer.**

### First data point — the Documents chat, question 2, 2 November 2026

`claude-sonnet-5-5` against `claude-opus-5-5`, three runs each, the full Documents brief, `DEV_MAX_SEARCHES=2`,
Cascade on staging. Runs: `tests/golden/documents/chat/runs/q2-A-1..3.json` and `q2-A-opus-1..3.json`.

| | Sonnet 5.5 | Opus 5.5 |
|---|---|---|
| the key (6 gaps of the EAP) | **6/6 · 6/6 · 6/6** | **6/6 · 6/6 · 6/6** |
| facts invented | 0 | 0 |
| must-nots breached | 0 | 0 |
| quotes shown / the check marked | 4.3 / **0.7** | 3.0 / **0** |
| quotes of six words or more (the only kind the check can verify) | **1 in 3 runs** | **0 in 3 runs** |
| sources the person can click | 0.3 | **0** |
| rule numbers written | 1.0, all from the reading | 1.7, all from the reading |
| carried the reading's own hedge | **3 of 3** | 2 of 3 |
| named the one paragraph letter the reading DID verify, as verified | 0 of 3 | **2 of 3** |
| documents named by title | 2.0 | 2.0 |
| searches | 0 | 0 |
| input / output tokens per answer | 16,411 / 1,170 | 16,328 / 1,485 |
| words per answer | 605 | 628 |
| seconds | 9.5 | **16.5** |
| cost per answer | $0.0445 | **$0.0950** |
| | | **2.13× the cost, 1.74× the wall time** |

**The tie-break, since the key is level at 6/6:** Opus is more careful with the *provenance* of a rule number —
it writes the paragraph letter the reading quoted and says so, and marks the ones the reading did not check
(*"except where shown"*). Sonnet carries the blanket hedge in all three runs but never distinguishes the verified
letter from the unverified ones. Against that, Sonnet produced the only clickable source in six runs, and Opus
produced none: both models quote short phrases that fall under the six-word floor, so on Opus **nothing in the
answer can be verified by the check or opened by the person.** Neither model searched.

**What it does NOT yet say.** Step 2 above has not been run for this tier — there is no page yet (4b). So this is
a probe result, and `AI_MODEL_DOCUMENTS` is not decided on it.


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

**Summaries send no effort setting** (effort null in the ledger), so the model's default applies, as on production.
The yardstick runs them the same way. Not HR's to change: the summary writer is shared with the workspace.

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
- **⚡ THE PARAPHRASE CHECK, ON OPUS — added at E2b, 4 November 2026.** Attach a document with a
  distinctive phrase in it (the fixture permit says *"Renewal Application Due 60 days prior to
  expiration"*), ask a question that needs that line, and **read the answer's sources**. On Haiku
  the old answer wrote *"60 days before expiration"*, `checkQuote` refused the paraphrase, and the
  attached permit was never a source — every item of the summary then said *"No source cited"*.
  E2b added one prompt sentence against it and made the file a source regardless; **what is not
  settled is whether the model then CITES it**, which only a real model shows. Count: refused
  quotes in the answer (`"we could not find these words"`), and items in the summary carrying a
  source. Haiku after E2b: 0 refused, 0 items citing.
- **The summary:** "Summarise this conversation" — **and since E2 (4 November 2026, decision 62) the
  thing to look at when it comes back is the FIVE CARDS**: What applies open with the first authority
  open and the rest folded, Still to confirm · Not answered here · Sources folded with their counts.
  One file draws it in six places, so a wrong reading here is wrong in all six.
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
- **no internal labels** ("H12") anywhere;
- **no offer of anything HR does not have** (the paid check offered a checklist; §183 adds HR's closing-offer
  sentence, measured here);
- **the answer stays on the person's question** (the paid check drifted into the company's general priorities).

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

### H. The go-live (HR-PLAN step 13) — DONE 8 October 2026 (`804d85e`, released with `073e900`, `DECISIONS.md` §181)

Items 1 to 6 are done:
- the owner added the two Vercel settings; the page is at `/hr`; old HR is retired; the switch is gone; the crons
  were already in place;
- **the release:** `check:live` on 3999 (43 ✓, 0 ✗); `npm run preflight` with 0 pending; pushed. The deploy was live
  at 21:08 UTC (`PATCH /api/handbooks` with no login: 404 before, 401 after).
- **The free live checks on `https://compliboard.vercel.app`:** `/hr` 200, serving the new page (its heading, lede
  and tabs in the HTML); `/hr/new`, `/api/hr` and `/api/hr-audits` 404; `POST /api/hr/answer` with no login 401.

**A second paid check, after the 11b and §183 release: DONE** (`DECISIONS.md` §184): the owner's second paid check, 9 October, after the 11b and §183 release, as CB-Test-3: Harbor deleted, added again from the Ask tab, and "Do our servers need a food worker card before their first shift?" asked at once. The answer (16:01:53 UTC) used Harbor, given as pages (text first: its text was saved, its sections not yet found; `waited_seconds` 0); it stayed on the handbook and closed with "If you'd like, I can write replacement wording for Section 1…", an offer HR can keep; the day-1 line showed; 4 sources, all official web pages (WAC 246-217-015, doh.wa.gov, clallamcountywa.gov, WAC 246-217-035); no handbook card (switch 3's gap); 7 cited passages, 17 pages searched, nothing dropped or marked. Ledger: the answer `hr`, `claude-opus-5-5`, effort medium, 2 searches, 24,983 in and 2,367 out, $0.167272, 25 s; the reading's outline `hr_check`, Opus, $0.016584.

**The paid check: DONE** (`DECISIONS.md` §183): the owner's paid check, 8 October, as CB-Test-3 with `tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf` and the question "What does this handbook say about food worker cards, and does it match Washington's rule?": the whole chain worked on production. Its 5 sources are all web pages, all official (WAC 246-217, doh.wa.gov, WAC 246-217-015, clallamcountywa.gov, kingcounty.gov), with no handbook card (the answer did not quote the handbook). Its ledger row: `hr`, `claude-opus-5-5`, effort medium, 2 searches, 25,061 tokens in and 2,236 out, $0.164964, 26 seconds. Two findings: it offered a checklist HR does not have, and drifted from the question; the first is answered by §183's closing-offer sentence.

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

### I. The morning after (HR-PLAN step 14) — DONE 9 October 2026

- `job_runs`: the summary row after 10:00 UTC, now including HR conversations; the `handbook_checks` rows for the
  queue and the sweep; the delete row after 10:30 UTC.
- **The result, 9 October:**
  Five read-only queries on production (the Supabase CLI's own connection; SQL in `docs/HANDOFF-FROM-HR.md` §7 item 3
  and below). **All four job rows `ok: true`, `errors: []`, `finished_at` set:**
  - `summarise` 10:00:21 → 10:00:50 UTC: considered 1, summarised 1, skipped_user_summary 4, proposals 0;
  - `handbook_checks` (the night queue) 10:00:49 → 10:00:50: `job: 'queue'`, queued 1 (Harbor, `new_handbook`),
    not_due 0, skipped_open none;
  - `handbook_checks` (the sweep) 10:00:50 → 10:01:31: pieces 1, rows_done 4, checks_finished 1, failed 0, retried 0,
    notified 0, sent none, wall 40.9 s;
  - `delete` 10:30:04 → 10:30:04: topics_cleared 0, turns_deleted 0.
  - **Harbor's check:** `new_handbook`, done, 4 of 4, nightly, `notified_at` null (no email); `checked_at` 10:01:30,
    `next_check_at` 7 January 2027.
  - **The night's summary was a workspace conversation** ("Final paycheck deadlines when an employee quits (Oregon)",
    `ac6f3cb1`, 10:00:50): `select id, section, title, summarised_at, summary_source from public.topics where
    summary_source = 'nightly' and summarised_at >= '2026-10-09 09:55+00' and summarised_at < '2026-10-09 10:05+00'`.
    CB-Test-3's HR conversation was summarised by the person's own press at 22:41:48 UTC on 8 October
    (`summary_source 'user'`), and the night left it alone, as its rule says. **The nightly HR summary is proven on
    staging (§178), not yet on production; it will be the first time an HR conversation is left unsummarised.** That
    is not a failure.
  - **The night's cost: $0.316124**, both on `claude-opus-5-5`: the summary $0.082548 (effort null, see B), the check
    $0.233576 (effort medium, 3 searches).
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

## The Calendar

*Written 19 October 2026 by the Calendar chat at its close-out (`docs/CALENDAR-PLAN.md` step 15). Same shape as
HR's part above; the Calendar does not edit HR's.*

### A. Where the Calendar stands (19 October 2026)

- **Built through step 14b and RELEASED.** `main` at `da7d2f0`; production serves `/calendar`.
- **Migrations `073`–`079` are on production** (`npm run preflight`: `PENDING COUNT: 0`; the owner applied 079 on
  19 October). Read back afterwards: **67 live rows placed, 7 needing a day**, the 20 that moved being exactly the
  class 079 was written for.
- **The record:** `docs/CALENDAR-PLAN.md` (v19), `DECISIONS.md` §185–§202, the manual sets C7–C14b in
  `docs/TESTING.md`, and `docs/HANDOFF-FROM-CALENDAR.md`.
- **The go-live happened before the finish line**, as HR's did and for the same reason: holding it would leave the
  old 601-line `/calendar` page on production, whose Add and × buttons have been broken since step 5.
- **One gate is still shut and it is deliberate:** the Resend sending domain. While the `from:` is
  `onboarding@resend.dev`, the monthly job refuses to send on production — claims nothing, sends nothing, writes
  the reason on its `job_runs` row, answers 503. **So the first monthly email is not a finish-line item; it is
  waiting on DNS.**
- **Held for the finish line:** the yardstick (D, E), the manual sets (F) and both switches (G).

### B. Settings for every Opus run

Always on an **isolated server copy** (port 3998, `HOW-WE-BUILD.md` §3c). `.env.local` is never changed for this.

| Setting | Value for the finish line | Why |
|---|---|---|
| `AI_MODEL_CALENDAR`, every `AI_MODEL_*` | `claude-opus-5-5` | As production |
| `AI_EFFORT` | `medium` | Production's |
| `DEV_MAX_SEARCHES` | `0` in the server's own environment | The laptop sets `2`; `0` reads as no limit, as on production |
| `RESEARCH_PROVENANCE`, `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST` | `true` | Production's; the Calendar's prompt is built from the shared one |
| `NOTIFY_TEST_TO` | the test inbox | **Every email in these runs must land there.** It is absent on production by design and must stay absent |
| `VERCEL_ENV` | unset | Set it to `production` only for the one guard probe in C |
| `CRON_SECRET` | as staging | The monthly job answers 404 without it |

**Prove the settings held:** the ledger shows `claude-opus-5-5` at effort medium for task `calendar`; the server log
names no search limit; `npm run haiku:check` **refuses** — its refusal is the proof the run is not on Haiku.

**Cost:** `npm run cost` before and after. Step 13 measured an Opus answer at **$0.157–$0.273**; budget the
yardstick from that, not from Haiku's $0.0073.

### C. The machinery on Opus (one run per paid path) — DONE 16 October 2026 (`DECISIONS.md` §199)

Five real calls on `claude-opus-5-5` at `AI_EFFORT=medium`: two answers, a follow-up, a summary, and one capture to
measure the narration rule. **$0.9109 of a $2.00 budget.** Nothing broke. **The monthly email calls no model**, so
it had nothing to run here — its paid path does not exist.

**What it found, and these are the finish line's starting facts:** an answer costs **21–37× what Haiku's did**,
because Opus searches where Haiku did not; 4 of 5 web sources were official where Haiku had 0 of 3; it named the
title drift to the customer and said "I can't tell you yet" where it did not know. **The narration rule withdrew
zero characters on Opus** (`HANDOFF-CODE.md` §7's row closed on that measurement).

**Still to run on Opus:** nothing paid changed at step 14b, but the chat's brief now states a day where it said
"no day read yet" for 20 production rows, so **D's first answer case is worth re-asking once** on a company that
has one.

### D. The yardstick: the real scenarios, each with a written key

**The lesson from the build.** Every defect this section found came from a *shape of row*, not from a question:
the same obligation worded three ways, a day with no period, a period with no day, a date somebody removed. So the
Calendar's yardstick is **scenarios first, questions second** — set the row up, then look.

Each is run on **at least two models** (Opus 5.5 and one cheaper, as the owner chooses), three times each, and the
key is written **before** any run. Where it lives: `tests/golden/calendar/` — scenarios and keys only, never a real
customer document.

| # | The scenario | The key: what must be true |
|---|---|---|
| 1 | **A document scanned twice, with the same date worded differently** ("Annual maintenance of all portable fire extinguishers", then "Next annual maintenance due for all units") | **One live date, not two.** The second reading either meets the first (`existing`) or supersedes it (`replaced`); the earlier wording is withdrawn, not dismissed, and the drawer's history says what happened. **This is the one the build could not fix** — three Opus readings of one certificate made nine rows (§187, §189) — so the key is what decision 29 guarantees, not what the model says |
| 2 | **A repeating date with no day** ("Fit testing shall be repeated at least annually", no date) | Filed, `recurs = true`, `due_date` null, `next_due` null. **On neither the grid nor the list.** In *Dates to confirm* under **"Needs a day or how often (N)"**, and counted in the one line at the foot of both views. Not in the `.ics`. The email's line names it |
| 3 | **A repeating date with a day and no period** ("next annual maintenance due 20 August 2026") | **On the grid and in the list on that day**, like any other date (migration 079). If the day is behind us it reads **"passed N days ago"** in amber and is faint — and is **not** offered as the next date in the info bar. In the `.ics` as **one non-repeating event**. The drawer offers "Set how often" and **not** "Set the day" |
| 4 | **A date a person removed, that the scanner finds again** | It stays removed (rule b). `proposeDate` returns `existing`, nothing is revived, the drawer shows who removed it and when, and the report drawer says the date is not on the calendar. **A dismissal is final in the database too** — a person cannot confirm it back (23514) |
| 5 | **An audit that finds a date the scan already filed** (same document, same day, a different title) | **One row, the document's**, which gains `audit_finding_id`; the outcome is `existing` (decision 31). The drawer shows the audit as context, not as the source. **The source card is decided by `source`, never by which id is set** |
| 6 | **A company with two sites** | Every row says which site; a company-wide date says "Every site"; the site filter appears. **With one site nothing about sites shows anywhere** (decision 24). The monthly email groups by site only with more than one. A document moved to another site moves its dates with it, with no write to the calendar |
| 7 | **The monthly email on a month with nothing due** | It is still sent, and it says **"Nothing is due in ‹Month›."** It never says "no dates" when the read failed, and it carries **no confirmed or not-confirmed marks** (decision 18). The claim row is written **before** the render, so a second run the same month sends nothing |
| 8 | **A question about a date that is NOT on the calendar**, where the rule says one exists | The answer says plainly that the date is not on the calendar, cites the rule with its page, and **ends with the offer**: "Add ‹title› — due ‹day›, ‹how often› — to your calendar". One click files it as **confirmed with the presser's name** (decision 17). The grey line under the answer names any cited date nobody has confirmed |
| 9 | **The feed in Google Calendar** | Subscribe with the link; the dates appear; a date confirmed, added or removed in CompliBoard shows in Google **within a day**. A repeating date with a period carries its RRULE; one without is a single event. **The person's own note is in neither the feed nor the download.** Rotating the token in the sheet kills the old link |
| 10 | **A person sets a day** (scenario 2's row) | "Set the day" in the drawer; one PATCH; the date lands on the grid under its new month and leaves the section, with the foot line's count one lower. **Then it cannot be changed**: the control is gone, and a direct write is refused by the database (23514), not only by the screen |
| 11 | **"The certificate gives the month, not the day"** — the case the product **cannot yet say** | Decision 30's own worked example, and the one line of it that is **not built**: nothing records that a document gave only a month (`document_deadlines` has `due_on`, `recurs`, `source_line` and no precision flag). **The key is that the product says nothing false** — it shows the day it was given and does not claim the document named it. Judge whether that is good enough, or whether the flag (§7 item 7 of `docs/HANDOFF-FROM-CALENDAR.md`) is worth building |

### E. The yardstick: what to judge

**Answers (the Ask tab):**
- the right answer against the key, with the date's own source named — the document, its page and the line;
- **a date the calendar holds is cited as a date, with a link that opens its drawer** — not described in prose;
- the grey line appears when, and only when, the answer leaned on dates nobody has confirmed;
- **an offer is never hedged** (the owner's addition to step 10a's prompt) and names exactly what would be written;
- **no internal ids** anywhere in the prose (step 10a's first defect);
- official sources first, counted official against other, as HR's part counts them;
- the answer stays on the question asked.

**The rows themselves:** after every scenario, read the table, not the screen —
`select title, status, recurs, period, due_date, replaced_by, withdrawn_at from calendar_events …`. Four of the
eleven scenarios are about *which rows exist*, and a screen that looks right over a wrong row is the failure this
section exists to prevent.

**The monthly email:** what it says, on a real month, for a company with two sites; every link opens the right
drawer; the footer; **and one on a month with nothing due**.

**Cost and time** per answer and summary: searches, tokens, seconds. Decides whether a search limit is set.

### F. The manual sets in `docs/TESTING.md` (the owner, on Opus)

C7 (the page shell), C8a and C8b (the two views, the drawer, Add a date, the feed), C9 (the queue), C10 (the chat
and the offer), C11 (the email), C12 (the Dashboard and the moves a person may make), C13 (Opus), C14-1 to C14-3
(the release and the sandbox guard), **C14b-1 to C14b-3 (a clean calendar)**.

### G. The switches, each measured against the baseline (after it)

The Calendar has **two**, and both are other sections' work:

1. **`same_as_deadline_id` in the document-scan prompt** — the long-term fix for scenario 1. Decision 29 works
   around the drift in the data; this stops it happening. A Documents prompt change, so it is measured against
   Documents' golden set as well as scenario 1.
2. **A month-only precision flag on `document_deadlines`** — scenario 11. A Documents schema and prompt change.

**And one question for the owner, not a switch:** `AI_MODEL_CALENDAR` is Opus 5.5 today. Step 13 measured what that
buys. Sonnet 5.5 against Opus 5.5 for this tier is worth one measured comparison at the finish line.

### H. The release (CALENDAR-PLAN step 14) — DONE by the owner, 16–19 October 2026

`docs/RELEASE.md`'s calendar routine, step 0 to step 9, run by the owner. Production is on `000`–`078`.
**Step 3a is done too:** migration 079 went to production on 19 October and was read back (67 placed, 7 needing a
day). **Still open from it:** step 0 — the DNS gate and the four `from:` lines — and the one paid check, one
calendar answer as the owner's own company, $0.20.

### I. The morning after, and 1 November

- **The morning after a push:** `job_runs` for `calendar_month` — there will be none until the 1st — and the free
  checks in the routine's step 6.
- **1 November, 14:00 UTC, the first monthly email.** Read `job_runs` and `calendar_mailings` the same morning:
  one row per company, `sent_at` stamped, `sent_to` holding the real addresses. **If the DNS gate is still shut,
  the row will instead carry the refusal and nothing will have been sent** — that is the guard working, not a
  failure, and it is the only way to tell the two apart from the database.
- Then the Calendar's part of this file is scored, and `STATUS.md`'s row updated.

### J. Open items, and the shared files the Calendar depends on

**Open items that touch testing** (`HANDOFF-CODE.md` §7, and §7 of `docs/HANDOFF-FROM-CALENDAR.md`):
- the sending domain's DNS, and the three older emails that still send from the sandbox address;
- whether the three older emails have ever reached anybody but the owner — only the Resend dashboard can say;
- Company information's literal `'FACTS_CHANGED'`;
- `check:live` cannot be pointed at production, so the production checks are unauthenticated probes.

**Staging test data to clean before the yardstick:** the build-test conversations on all three companies, and the
probe dates left by the step walks.

**Shared files the Calendar depends on.** A change to any of these before the finish line re-runs the Calendar's
free checks; a change to the first two after its yardstick makes it stale:
- `lib/ask/*` and `prompts/ask.ts`: **the Calendar's answers are built from them**, and three more sections are
  about to move onto the same engine (decision 28) — so the Calendar's yardstick runs **after** the last engine
  change, not before;
- `lib/email.ts`: the one template, which the three older emails are about to move onto;
- `lib/topicList.ts`, `lib/topicClaim.ts`, `lib/listWords.ts`, `lib/conversation.ts`, `lib/summaryReport.ts`,
  `lib/howTo.ts`, `lib/documentStatus.ts`, `lib/printFrame.ts`, `lib/pipelineConfig.ts`, `lib/ai.ts`;
- `components/Drawer.tsx`, `Sheet.tsx`, `Tabs.tsx`, `Empty.tsx`, `AnswerBody.tsx`, `ReportView.tsx`,
  `ConversationList.tsx`, `AttachControl.tsx`, `buttonStyles.ts`, and **`DocumentReport.tsx` and `AuditReport.tsx`,
  which the drawer's second tab renders whole**;
- `lib/documentScan.ts` and `lib/auditRun.ts`: **they are where dates come from.** A change to either is a change
  to the Calendar's input;
- `vercel.json` (the cron entry).

---

<!-- Other sections: add your part below, in the same shape (A to J). -->

---

# The Dashboard

**Released 20 October 2026** (`3c2c2bf`, plus the hotfix `f4e09d4`); migrations 080 and 081 on production.
`docs/HANDOFF-FROM-DASHBOARD.md` is the file to read first.

### A. What is different about this section

**No model is called anywhere on the Dashboard**, so every scenario below is **free**. There is no paid path to hold
for the finish line and no Opus run to budget. What is held here is not cost — it is the things only a person can
judge, and the things that need a second company, a second day, or a database reset to see at all.

**Two settings before any of it.**

- **Run at least one pass against a production build** — `npm run build && npx next start` — not the dev server.
  `DECISIONS.md` §206: the one defect a customer found was invisible to `next dev`.
- **Reset `profiles.welcomed_at` to null immediately before any first-visit scenario**, with the service role.
  Signing in through the form lands on `/dashboard` and records the visit, so simply logging in spends it, and the
  database refuses every later change.

### B. The counters — each event moves its own number by one

| # | Do this | Expect |
|---|---|---|
| B1 | Note the four numbers. Read one document. | **Files read +1**, the other three unchanged |
| B2 | Read the **same** document again | **Files read +1 again.** The label says readings and the trigger counts readings. If this surprises you, the label is what to change |
| B3 | Upload a file the product cannot read | **Files read does not move.** `status = 'could_not_read'` is excluded by the trigger's WHEN clause |
| B4 | Run an audit to completion | **Audits done +1** |
| B5 | Make a checklist | **Checklists created +1** |
| B6 | Start a checklist and let it fail halfway | **Checklists created +1 anyway.** The row is inserted before the work is done. Decide whether the label should read "started" |
| B7 | Ask a question in a chat and let it finish | **Questions answered +1** |
| B8 | **Ask a question and stop it part-way** | **Nothing moves.** This is the one counter still kept in code, for exactly this reason |
| B9 | Delete a document you read | **Files read does not go down.** Counters record events, never inventory |

### C. The welcome

| # | Do this | Expect |
|---|---|---|
| C1 | Reset `welcomed_at` to null, then open `/dashboard` | **"Welcome, ‹first name›"** and the first-visit lede: *"This page will show what has been done and what is coming up. Three quick questions below get things started."* |
| C2 | Reload | **"Welcome back, ‹first name›"**, and the lede changes |
| C3 | Clear `full_name` on the profile, reset `welcomed_at`, open it | **"Welcome"** — not "Welcome, " with a comma and nothing after it |
| C4 | With no name and a visit recorded | **"Welcome back"** |
| C5 | Try to change `welcomed_at` as the signed-in person | Refused, 23514: *"Your first visit is already recorded and is not changed here."* |

### D. The three questions

| # | Do this | Expect |
|---|---|---|
| D1 | Open the Dashboard on a company with questions left | **"1 of 3"**, one question, its grey help line, the answer buttons, and "I don't know yet" |
| D2 | Answer it | The next question, **"2 of 3"**. **Nothing says what the answer did** |
| D3 | Answer two more | After the third: **"Thanks — that's all for today. We'll ask a few more another day."** and *"Your answers are in Company information if you want to change one."* |
| D4 | Reload | The quiet card again, and **no request goes out** |
| D5 | **Come back the next calendar day** | Three more questions. The day turns at **your** midnight, not UTC's |
| D6 | Press "I don't know yet" | The next question shows and **the number still reads the same**. A skip is not an answer, and nothing is written anywhere |
| D7 | Reload after a skip | The skipped question is still skipped (browser storage). **In a private window it comes back** — that is the designed cost |
| D8 | Answer one, then open **Company information** | The fact is there under its topic, reading *"you answered · ‹the question›"* — and the editor shows the same question and the same help line |
| D9 | Reach an option question | The buttons read **words** — "Toll processor", "ISO 9001", "Neither" — never `toll_processor` |
| D10 | A company with every company-scope question answered | **No heading and no card at all.** Not an empty card, not a "well done" |

### E. Upcoming

| # | Do this | Expect |
|---|---|---|
| E1 | A company with 1–6 dates in the window | Each row: the title, then the Calendar's own meta line, then the when-word on the right. **Seven or more days out is grey; a week or less is amber** |
| E2 | **A company with more than six** | Six rows and one grey line: **"N more in the next 30 days."** with "See them on the Calendar". *No fixture has this today — it is held by unit tests only* |
| E3 | A date that is not yet confirmed | **"not confirmed" is the FIRST thing in the grey line**, before the date and the document. Check the same row on the Calendar's list tab: same order |
| E4 | A row whose document has a very long title | The line truncates — **but never on the state**. That is the whole point of E3 |
| E5 | Click a row | `/calendar?tab=calendar&date=…` with that date's drawer open |
| E6 | Count the rows plus the "more" number | It equals the Calendar's own count of live dates within 30 days |

### F. Recent audits

| # | Do this | Expect |
|---|---|---|
| F1 | A company with audits | The last three `done` runs, newest first: the name, the site and the date, "Open the report" |
| F2 | **Dismiss a run on the Audits page, then look again** | **It is still there.** Dismissing clears a banner; the work was done |
| F3 | Click a row | `/audits?run=…` with that report open |
| F4 | **Press the X** | **The report closes and the address becomes `/audits`.** Then press Escape on another one, and click the scrim on a third. All three close it. **This is the hotfix** — `DECISIONS.md` §206 |
| F5 | Close it, then click a sidebar link | It navigates. The scrim is not swallowing the click |
| F6 | An HR handbook check | **It does not appear here.** Handbook checks are `handbook_checks`, not `audit_runs` |

### G. Day one — a company with nothing

| # | Do this | Expect |
|---|---|---|
| G1 | A brand-new company's Dashboard | **Four em dashes in faint grey**, never a 0, and no coaching line |
| G2 | Upcoming | *"Deadlines from your documents will be displayed here."* and **Add a document** |
| G3 | Recent audits | *"Your recent audits will show here."* and **Run your first audit** |
| G4 | The questions | **They work on day one.** A company that has uploaded nothing can still answer three |
| G5 | Break the network and reload | Upcoming says *"We could not load your dates just now. Nothing has changed…"* — **not** the day-one line. A failed read is not an empty calendar |

### H. The sidebar, on every page

| # | Do this | Expect |
|---|---|---|
| H1 | Visit all eight signed-in pages | The same order every time: Dashboard · Compliance Workspace · Audit Workspace · HR Workspace · Calendar · Documents — **a hairline** — Company information · My Account |
| H2 | On each | The page you are on has **no green box**: the word in dark green, medium weight, with a 2px green underline a little under it. Compare it with a workspace's active tab — **the same two greens** |
| H3 | A count | A plain grey number, **no pill**, and nothing at all at zero |
| H4 | Anywhere | **No breadcrumb** beside the wordmark. The logo is unchanged and still goes to `/dashboard` |
| H5 | "Documents" and "Audit Workspace" | They go to `/documents` and `/audits` — the words changed, the addresses did not |

### I. Open items, and the shared files the Dashboard depends on

- **The three parked items** — `docs/DASHBOARD-PLAN.md`, "Parked for the final check". The owner's decision.
- **The scanner's invented keys** (Documents) — they reach the confirmation queue and three prompts.
- **The three forked site questions** — before any site question is asked anywhere.
- **Shared, and changed by this section**: `lib/calendarView.ts` `metaParts` (the Calendar's list changes with it),
  `components/Drawer.tsx` (Escape, every drawer in the product), `lib/auditView.ts` (the Audits page's own words),
  `scripts/measure-layout.mjs` (the sidebar, the top bar, a column on a page that does not print).

---

## My Account, part A

*Written 21 October 2026 by the My Account chat at the step 11 preparation (`docs/ACCOUNT-PLAN.md` steps 5–10).
Same shape as the parts above; this one does not edit theirs.*

### A. Where My Account part A stands (21 October 2026)

- **Built through step 10, NOT released.** `main` is at `c22025b`; `account` is ahead of it and fast-forwards.
- **Migrations 082 and 083 are on STAGING only.** `npm run preflight` against production lists exactly those two.
- **The record:** `docs/ACCOUNT-PLAN.md` (22 steps, 17 decisions), `docs/account-boards.html` (boards 1, 1b, 2, 3, 5),
  `DECISIONS.md` §207 and §208, and `docs/ACCOUNT-MACHINERY.md` for what the page was before.
- **Everything in part A is free.** No step of it calls a model: the Company tab, the site drawer, the geocoder,
  People, `/join`, Sign-in and Cancel between them make zero `lib/ai.ts` calls, and `npm run cost` read **$3.45 / 63
  calls at the start and the end of every one of steps 5 to 10**. So this part has **no C section and no D or E**:
  there is no paid path to run on Opus and nothing for the yardstick to measure. The website read at step 13 is part
  B's, and it is the first paid thing My Account does.
- **One gate is shut and it is the same one the Calendar is waiting on:** the Resend sending domain. Everything
  below marked ✉ is deferred for that reason and for no other.

### B. ✉ THE EMAIL TESTS, DEFERRED UNTIL RESEND IS LIVE

While `from:` is `onboarding@resend.dev`, `lib/email.ts` `sandboxSenderRefusal` refuses every send on production.
Each of these is **do this, see that**. Run them on production once the domain is verified, signed in as yourself,
using a tagged address you own (`you+cb1@…`, `you+cb2@…` — a fresh tag per test, because an address that already
has a login takes a different path).

| # | Do this | See that |
|---|---|---|
| **B1** | My Account → People → Invite someone → `you+cb1@yourdomain` → Send the invitation | The row appears as **Invited**, *"invited ‹today› · the link is good for 7 days"*. **No** "not switched on" sentence |
| **B2** | Open your inbox | One mail, subject **"‹your name› invited you to CompliBoard"**, one button **"Join ‹company›"**, the footer saying the link is good for 7 days and that ignoring it costs nothing. **The token is in the link and nowhere else in the mail** |
| **B3** | Click the button | `/join` shows *"‹you› invited you to join ‹company›"*, the invited address **read-only**, Your name, Password (at least 10) |
| **B4** | Fill them in → Join ‹company› | Lands on `/dashboard` with **"Welcome, ‹first name›"**. People now shows two rows, the new one with **You** |
| **B5** | Open the same link again | *"This link has already been used. If that was you, sign in instead."* with a sign-in link |
| **B6** | As the first person: invite `you+cb1@…` again | *"‹address› can already sign in."* |
| **B7** | Invite `you+cb2@…`, then **Send the link again** | A second mail arrives. The first link, opened, says the invitation was withdrawn |
| **B8** | **Cancel** that invitation, then remove the B4 person | The Invited row goes; the person's row goes after the sheet (*"Remove ‹name›? They will no longer be able to sign in. What they did here stays."*), and their login no longer signs in |
| **B9** | Sign-in tab → Change (Email) → `you+cb3@…` → Send a confirmation | The row's grey line reads *"We sent a link to ‹new›. Until you click it, ‹old› still signs in."* **Then check: did ONE mail arrive or TWO?** See G |
| **B10** | Click the confirmation link, then sign out and sign in with the NEW address | It signs in. **Then sign in with the old one** — it should not |
| **B11** | Sign-in tab → **Send me a reset link** | The row reads *"Sent. Check your inbox."*; the mail arrives; its link opens `/reset-password` with a working form |
| **B12** | On that page set a password of **9** characters, then 10 | 9 is refused (*"Your new password needs at least 10 characters."*), 10 is accepted and signs you in |
| **B13** | Open `/reset-password` directly, signed in, with no link | The form is **not** drawn: *"This page sets a new password from a reset link, and this is not one…"* with a link to ask for one. **This is the step-8 hole; it must stay shut** |
| **B14** | People: switch **one** person's monthly calendar email off, leave another on. Wait for the 1st, or run the job by hand | The mail goes to the person who left it on and not to the other. `calendar_mailings.sent_to` names only the first |
| **B15** | Switch **every** person's off, run the job | No mail. The `calendar_mailings` row's `error` reads **"everyone here has the monthly email switched off"** — not "nobody to send to", which is the different fact of a company with no logins |

### C. ✉ THE OTHER SECTIONS' EMAILS, WHICH THE SAME DOMAIN UNBLOCKS

Six senders exist. Read from the code on 21 October 2026:

| Sender | File | Deferred test |
|---|---|---|
| Monthly calendar email | `app/api/jobs/calendar-month/route.ts:202` | B14, B15 above — and it is the only one that already carries the guard |
| Audit finished | `lib/auditNotify.ts:185` | Run an audit on production; the notice arrives and `notified_at` is stamped only on a send that succeeded |
| Document batch read | `lib/documentBatch.ts:214` | Upload two files; one notice summarises both |
| Handbook check finished | `lib/handbookCheckNotify.ts:103` | Run an HR handbook check; the notice arrives |
| Invitation | `app/api/invitations/route.ts:148` | B1–B8 above |
| Feedback | `app/api/feedback/route.ts:10` | Send feedback from the top bar; it reaches the inbox |

> **AND THE THREE THAT DO NOT YET CARRY THE GUARD.** `lib/auditNotify.ts`, `lib/documentBatch.ts` and
> `lib/handbookCheckNotify.ts` send from `onboarding@resend.dev` on production **today**, with no
> `sandboxSenderRefusal` check — `lib/email.ts`'s own header says they take it in the same commit that moves all
> four `from:` lines to the verified domain, "where it is inert from the moment it lands". **That commit is the one
> this section is waiting for**, and it is the right moment to give them the guard.

### D–F. Nothing held

No paid path (A), so no Opus run, no yardstick, no switches. The manual sets for part A are the live checks in
`docs/RELEASE.md`'s My Account part A routine, and they are free.

### G. ✉ ONE SETTING TO READ AND RECORD

**Authentication → Providers → Email → "Secure email change"**, in the Supabase dashboard, for **both** projects.

It could not be read from here: `GET /auth/v1/settings` returns `mailer_autoconfirm: false` and **does not expose
it**, and the Management API needs a personal access token this session does not have and should not use. So it is
a dashboard reading, and it decides one sentence:

- **If ON** — a change of address mails **both** the old address and the new one, and both links must be clicked.
  Board 3's line then needs one more sentence saying so, and B9 should see two mails.
- **If OFF** — only the new address is mailed, and the line as written is complete.

**Write the answer into `docs/ACCOUNT-PLAN.md` open question 3** when you have it; that question is half answered
and this is its other half.

### H. What is NOT deferred, and was proved on staging

Everything else. For the record, so nobody runs it twice: the Company tab and its NAICS suggestions; the geocoder
against the real Census endpoint (Portland → Oregon/Multnomah, Vancouver WA → Washington/Clark, a nonsense address
→ the sentence and the county box); the site drawer, including that removing a site with rows attached is refused
by the database and that the main site has no Remove at all; the company row mirroring its main site (083);
`/join` walked end to end with a real 24-character password; remove, with its two refusals and a cross-tenant 404;
the export (200, 336.6 KB); and both `?tab=` tabs measured identical to `/calendar`.

### I. The morning after

`job_runs` for `calendar_month`. And on the 1st of the month following the domain going live, check that the
monthly email actually went — the guard means **a refused month leaves a row saying why**, so a missing row is a
different and worse fact than a refused one.

### J. Shared files this section changed

A section that changes one of these re-runs the free checks of every section that uses it.

| File | What changed | Who else uses it |
|---|---|---|
| `components/DashboardQuestions.tsx` | the answer control moved out | the Dashboard |
| `components/SwitchAnswerControl.tsx` | **new**, shared | the Dashboard and My Account |
| `lib/calendarEmail.ts` | `monthlyRecipients` added | the Calendar's monthly job |
| `app/api/jobs/calendar-month/route.ts` | reads `calendar_email` | the Calendar |
| `lib/companyContext.ts` → `lib/placeLine.ts` | `siteWhere` moved, body unchanged | `lib/audit.ts`, every prompt that renders a site |
| `scripts/schema-doc.js` | prints column-level grants | every section's `docs/SCHEMA.md` |
| `scripts/measure-layout.mjs` | `--type "<label>=<text>"`, password fields, masked echo | every section's measured walks |
| `app/reset-password/page.tsx` | gated on a real recovery; floor 6 → 10 | the whole product's password recovery |
| `app/company-information/page.tsx` + its route | the name, state and city left its company block | Company information |

---

## My Account — part C (billing)

### A. Where it stands (29 October 2026)

Released. `main` at `e81ecbb`, migrations 087–090 on production, every trial parked at 2027-01-31.
**⚡ Billing is INERT: no Stripe variable is set**, so everything in this part is **blocked on
`docs/RELEASE.md`'s "When Stripe live mode is ready"** and none of it can be done before that.

### B. What waits for Stripe live mode

| | | costs money? |
|---|---|---|
| **1** | Checkout with a real card end to end: live-mode page, charge succeeds, back on `?card=added`, tab reads `Active · Next payment <date> · <brand> ending <4>` | **$199**, refundable |
| **2** | Read the mirror back: status, period end, card line, and `next_charge_amount_cents = 19900` | no |
| **3** | The **reconcile** (§220/§222): blank `stripe_subscription_id`, load Billing, watch it repair and file `reconcile.repaired` | no |
| **4** | The **grace** (decision 11): a declining card at the renewal → `invoice.payment_failed`, `payment_failed_at` written, banner up, **access still full** | **$199** attempted |
| **5** | The **recovery**: fix the card → `invoice.paid` clears the anchor and the banner goes | $199 |
| **6** | The **coupon**: `FOUNDER100` at checkout → $0, no card form, and the tab reads `$0 a month — FOUNDER100, 100% off, forever` with **no card asked for** | no |
| **7** | Stripe's endpoint delivery log: **six event types, all 200.** Retries pending there are §222's failure in advance | no |
| **8** | `npm run check:live`'s **billing-mirror question** (§222 H) — an empty list is evidence deliveries are landing | no |

**Do 1, 4 and 5 on a company created for the purpose, not on CB-Test-3.**

### C. The one thing that is still a hypothesis

A subscription with **no payment method at all**, reaching the end of a `repeating` discount. We
expect `invoice.payment_failed` and the grace; a card that *fails* is observed, a card that is
*absent* is not. **Until it is, forever coupons only** (§217). Provable with a test clock plus a
repeating coupon and no card, and it does not need live mode — it can be done on the sandbox before
the gate opens, which makes it the cheapest item on this page.

### D. What does NOT wait

Everything that is not Stripe. The read-only rule at 19 doors and 4 sweeps, the banner, the Billing
tab's words in every state, the 402 wording, and the two repairs are all covered by 2063 unit tests
and were walked on staging against a production build. **The deferred email tests from HR and the
Calendar are unchanged by this part** — billing sends no email, and the one it owes (before a
discount ends, §221 F) is not built.

---

# The Documents chat

*Added 2 November 2026 by Part A step 4a-test (`docs/GAPS-PLAN.md`). The other sections' parts are A to J;
this one is A, D and E only, because the chat's page and routes are not built yet (step 4b) and the rest has
nothing to describe. It is written now because **the six keys exist and have been run**, and a key written
after an answer is not a key.*

### A. Where the Documents chat stands (2 November 2026)

- **The brief, the prompt and the quote fix are built; the page and the routes are not** (step 4a done,
  4a-test done, 4b not started). There is nothing on screen to walk.
- **Measured on `claude-sonnet-5-5`, 2 November 2026**, 39 calls, $1.14, against Cascade's twelve real
  readings on staging: `tests/golden/documents/chat/keys.md` and `.../runs/`.
- **Held for the finish line:** the same six keys on **Opus 5.5 at production settings**, the switches below,
  and whatever the owner changes in the prompt after reading 4a-test's three side-by-side answers.

### D. The yardstick: the six scenarios, each with a key written before the run

**Where they live:** `tests/golden/documents/chat/keys.md` — written from `packDocumentsContext`'s own output
with `--pack-only`, which calls no model. The fixture is **Cascade on staging**, twelve documents, one permit.
Reproduce the context with:

```
node --env-file=.env.local scripts/probe-documents-answer.mjs \
  --as testcascade@example.com --ask "<the question>" --pack-only --show
```

**Every scenario runs twice: WITH the brief and the eleven sentences (A), and WITHOUT either (B)** — B being
`packContext` returning only the company block and no section sentences, which is the Compliance Workspace's
open answer and the owner's baseline (decision 2). Three runs each. A key that only A can pass proves the
context is worth its tokens; a key B passes too proves it is not.

| # | The question | The key: what must be true | Sonnet, 2 Nov |
|---|---|---|---|
| 1 | "Which of our permits expire in the next 12 months?" | **The air permit 26-2841-ST-01, expiring 15 November 2026**, named as the person sees it. The renewal application was due 18 July 2026 and that date has passed. **It is the only permit on file** — the DEQ annual report, the blank DEQ checklist and the SDS all carry "Oregon DEQ" and are not permits | A **4/4** ×3 · B **0/4** ×3, and B names a stormwater permit the company does not hold |
| 2 | "What's missing from our emergency action plan, and how do we fix it?" | **The six gaps in the reading, with their fixes, and no seventh.** Last revised February 2021; promises a January review. Where the reading hedges a rule number, the answer hedges it too | A **6/6** ×3 · B **3.7/6**, and B lists the federal elements from memory with `searches=0` |
| 3 | "Show me all our training records." | **One document: the PIT Operator Training and Evaluation Record.** The two forklift pre-shift logs are the same subject and the same kind and are **not** training records. Patel's three-year evaluation is overdue | A **3/3** ×3 · B **0/3** ×3 |
| 4 | "Do we have a stormwater permit?" | **Plainly, that it is not on file.** Not what one would contain; no implication they failed to keep one; no 1200-Z number from memory. Name the air permit they do hold | A **2/2** ×3 · B **0/3**: B never answers the question and gives the 1200-Z with `searches=0` |
| 5 | "What does the fire extinguisher certificate say about the six-year maintenance?" | **Units W-3 and L-1, before November 2026.** No other unit (2027, 2028, 2029). No NFPA section the reading itself hedged. **The certificate is Current, so it is in the message only because the question names it** — this scenario is the naming rule earning its keep | A **3/3** ×3 · B **0/3** ×3 |
| 6 | "What dates does this file set?", with the certificate **attached** | Every date in the file: service 20 Aug 2025, next annual 20 Aug 2026, W-3 and L-1 Nov 2026, the other units 2027/2028/2029, L-1's 2020 hydrostatic test. **Not** the reading's worked-out 2025 date as one the file sets. **And a quote from the file must come back clean** | A **4/4** · B **4/4** — **the one scenario where A is not ahead**, and B found the certificate's address (4410 NW Front Avenue) disagreeing with the company's (14604 NW Wendy Lane) in 3 runs of 3 where A found it in 1 |

**Scenario 6a, for the quote fix only** (added because scenarios 1–6 produced no quote from the attached file
at all): *"Quote the file's own sentence that lists what the technician did to each unit during the service."*
The key is that the quote comes back **clean, as source [1], against passage A1** — the sentence is in the file
and in no stored reading, so only the attached file's own text can match it. Run 2 November:
`attached_passages: 1`, `quotes_found_in_nothing: 1` — and that one mark was on a **document title in
quotation marks**, not on the quote (see E).

### E. The yardstick: what to judge

1. **Did it name the document, as the person would see it in their list** — never "R6", never "the permit in
   your list". `replacePassageIds` catches a bare handle; nothing catches "the permit".
2. **How many sources came back.** On Sonnet, 2 November: **1 across 36 runs.** An answer with no source is an
   answer with nothing to click, and step 4b's walk is "open a cited report from its card". Judge whether the
   prompt change proposed in 4a-test's report fixed it.
3. **Quote marks on a document TITLE.** Six of 36 runs put a title in quotation marks and the check marked it
   *"we could not find these words in what we have on file"*. It happens in B as well as A, so it is the
   engine's and not this section's. Two fixes are proposed in 4a-test's report; judge both.
4. **A rule number with `searches=0`.** Every number A wrote came out of a document it was given; B wrote one
   from memory in 12 of 18 runs. This is `CLAUDE.md` §3.3 measured, and it is the strongest single argument
   for the context.
5. **"Not on file", said plainly, when it should be** (scenarios 3 and 4).
6. **Whether it offers what it cannot do.** `offers` is `[]`, so `parseOffers` drops any block — but the model
   offered in prose in **18 of 36 runs** ("I can draft…", "Want me to?"). On screen that is a promise with no
   button. The owner's open question in `docs/GAPS-PLAN.md` §7 is now a measured one.
7. **Cost.** A costs about **2.4×** B for the same question ($0.039 against $0.016 on Sonnet), and that is the
   price of every key above.

---

# The Audits chat

*Added 3 November 2026 by Part A step 6b (`docs/GAPS-PLAN.md`). A, D and E, like the Documents chat's part —
the page, the routes and the one offer ARE built, and the walk is recorded in the plan's own §5 row rather than
repeated here. What this part is for is the finish line: the six keys, on Opus, at production settings.*

### A. Where the Audits chat stands (3 November 2026)

- **Built and walked on Haiku**: three tabs, the Ask box that takes commands and questions and decides which in
  code, `app/api/audits/answer` and `app/api/audits/topics/[id]/summarise`, and the one `run_audit` offer whose
  press starts the run against the company's own agency labels.
- **Measured on `claude-sonnet-5-5`, 3 November 2026**, 36 calls, $1.98, against Cascade's two real audits and
  thirteen documents: `tests/golden/audits/chat/keys.md`, `.../runs/` and `.../RESULTS.md`.
  **A scored 57 of 64 against keys written before any run; the Documents brief on the same six questions scored
  12.**
- **Held for the finish line:** the same six keys on **Opus 5.5 at production settings**, the two switches below,
  and the prompt as the owner leaves it.

### D. The yardstick: the six scenarios, each with a key written before the run

**Where they live:** `tests/golden/audits/chat/keys.md` — written from `packAuditsContext`'s own output with
`--pack-only`, which calls no model, and committed (`fdc83c3`) before the first call. The fixture is **Cascade
on staging**: two audits (one Oregon DEQ agency run, one against an auditor's checklist), thirteen documents,
four agency labels of which only Oregon DEQ has ever been audited. Reproduce the context with:

```
npm run haiku -- node --env-file=.env.local scripts/probe-audits-answer.mjs \
  --as testcascade@example.com --ask "<the question>" --pack-only --show
```

The six: (1) status on everything DEQ · (2) what the last DEQ audit found, and anything since · (3) an
auditor's checklist attached, *"check if we are good"* · (4) ready for an Oregon OSHA inspection, which has
never been audited · (5) which lines point at a document read since the audit, whose true answer is **none** ·
(6) why the permit is marked out of date, where the audit's word and the document's state are different things.

### E. The yardstick: what to judge

1. **Does it give the audit's DATE every time it uses what the audit found?** An audit is a record of one day,
   and the figures are only true about that day.
2. **Are the four words left as the audit said them?** "Nothing on file" is not "missing"; "out of date" is not
   "expired" unless a reading gives a date that has passed. And an `expected` row is a **suggestion**, said as
   one every time.
3. **Does it refuse the verdict?** Questions 3 and 4 invite "yes" or "no" and the product does not give one.
   *On Sonnet, A declined in 6 of 6; the Documents brief answered "No." once and "Not yet" once.*
4. **Does it invent a line that does not exist?** Question 5's true answer is none, and any list at all is
   invented. *On Sonnet, A said "none" with the reason in 3 of 3.*
5. **The offer.** Does the model write the block where decision 41 says it should, and would
   `checkRunAuditOffer` accept it? *On Sonnet: 18 blocks in 18 runs, 15 accepted, 0 naming an agency the company
   does not hold.* **And never a claim to have run one**: 0 of 18.
6. **Cards.** Six in 18 runs on Sonnet, three of them `F` — an audit finding, opening `/audits?run=`. This is
   the measure the Audits brief loses on against the Documents brief (eight, all `R`), and the quoting clause
   inherited from Documents has not fixed it in either section.
7. **Dates computed from the right anchor.** With no audit to anchor on, the Documents brief said the permit
   expires *"46 days from today"* — 46 days from the READING date — in 2 of 3 runs. A said 12 days, which is
   right. **Watch this one on Opus: a Haiku walk answer said 46 too**, so the anchor is not reliably used.
8. **Cost.** A costs about **1.44×** the Documents brief for the same question ($0.065 against $0.045 on
   Sonnet), and scores 4.75× against the keys.

---

## The audit's words — the fifth word, on Opus (Part E step E0, 4 November 2026)

### Why this is here and not done

**E0 widened the audit's vocabulary from four words to five and narrowed what the first one means.** Both halves
were measured on **Haiku**, twice, against the commit before them, and both do what they were built to do: five of
ten lines of the owner's own checklist moved from `on_file` to `on_file_gaps`, and every one of them is a line
whose body already listed what was missing. **What cannot be settled on Haiku is whether the narrowing sends a
stronger model to the wrong neighbour**, and two runs say it sends Haiku there twice.

### What to run

1. **The owner's Clackamas checklist, on Opus, three times**, with
   `scripts/measure-audit-words.mjs --label OPUS-n`. It takes the whole comparison — the word per line, the
   handles per field, `documents_read`, the summary sentence and the cost — and writes one JSON per run. The
   Haiku baseline is run **`a7c049db-3c23-4fc9-8412-82554e65bc7e`** (E0, before the three sentences) and
   **`8bee3ffa-2961-4bfe-b5a8-abf50cdfe41a`** (E0a, after them, and the one to compare against).
   **Count the sections that do not finish**, which is question 2b.
2. **`npm run golden:audit --times 3`, both modes**, which is the first time this set will have a `sections`-mode
   baseline of its own. Today's single Haiku run is recorded in `GAPS-PLAN.md` §8 finding 2 and is **not** a
   baseline.

### What to judge

1. ⚡ **UPDATED AT E0a — the question changed, because the defect did.** Haiku called a current permit *"out of
   date"* in 2 of 2 runs, and the owner's sentence of 4 November — *"A document still inside its own dates is
   never stale, whatever is missing from it: that is on_file_gaps"* — **closed it**: A1 is `on_file` in both
   E0a runs, with `what_to_do: null`. So the question on Opus is no longer *does it say stale* but **does it say
   `on_file` or `on_file_gaps` on A1, and is `on_file` right?** The line reads *"…not expired, **with the
   renewal application due date noted**"*, and nothing on file notes that date — Haiku treats the printed expiry
   as noting it. **If Opus does the same, the clause is being under-read and that is a question about the line,
   not the word.** `GAPS-PLAN.md` §8, E0a finding 2.
2. ⚡ **UPDATED AT E0a — the sentence did not fix the line it names.** The owner's second sentence, *"A line about
   what an inspector will see on the day is not_a_document_question even when a document bears on it"*, is in
   both shapes. On Haiku it **moved C2 and C3** of `cascade-template-12` and **left C1 exactly where it was** —
   `on_file_gaps` on *"pressure drop within range at the time of inspection"*, twice. **So C1 is the one to
   watch on Opus**, and if it fails there too the next thing to try is the shape of the rule rather than more of
   it: the practice test may need to be a question the model answers first (*can a document settle this at
   all?*) rather than a clause it weighs against the others.
2b. ⚡ **ADDED AT E0a, ANSWERED AT E0c, AND STILL COUNTED HERE: does Opus break its own JSON on a two-shortfall
   line?** Three of six Clackamas sections were lost on Haiku, every one the same shape, read out of
   `audit_sections.raw_text`: `"quote": "Rohan Patel's last evaluation was 2 February 2023" and "Marcus Reed was
   certified…"` — two quotes joined with `and` inside one string field, always on **B2**, which is the fifth
   word's own two-shortfall case. **The owner's sentence of 4 November took it to 0 of 3** — *"One quote per
   finding. If two things in the document fall short, quote the one the word rests on and put the other in
   what_to_do, in your own words — never two quotes joined inside the quote field"* — in both shapes, with
   `json_parsed = true` read back on all three sections. **One run is not a proof, so count it on Opus over the
   three runs anyway**, and read `json_parsed` and `status` off `audit_sections` rather than the script's
   output. If Opus still does it, the remaining fix is a repair inside `extractJsonText`, which is §3.1.
   **And check what the sentence costs**: B2 must still name BOTH operators, one in the quote and the other in
   `what_to_do`. On Haiku it did, and the action came out more specific than either earlier run's.
3. **Does the fifth word land on the lines it is for?** A3, B2, B3 and B4 on the Clackamas checklist are the four
   W4 named from the owner's own Opus run of 3 November. They should carry it.
4. **Is `on_file` ever written beside a shortfall again?** That is the defect the whole word exists for. Read every
   `on_file` line's `what_to_do` and look for *missing*, *overdue*, *not covered*.
5. **Does a handle reach the person?** 0 of 10 lines on Haiku after the sweep, from 6 of 10 on the owner's Opus run
   of 3 November. On Opus it should be 0 of 10 in prose and **the quotes must be untouched** — a document whose own
   text says "D1" must keep it.
6. ~~**`cascade-template-12` A5.**~~ **Settled at E0a**: the owner widened the key to accept `on_file_gaps`
   beside `nothing_on_file`, with the reason on the case — the 2025 annual report records the deviation and the
   notification evidence is what is missing, which is a document answering the line in part. It passes now. The
   case's remaining failures on Haiku are **C1** (question 2 above), **C4** and **B3**; the last two are one run
   each side and inside this set's noise.
7. **Cost.** A Clackamas run is 4 calls: $0.084 on Haiku, measured. Record Opus's, for the model table above.

### The shared files this part depends on

`lib/auditRun.ts` · `lib/audit.ts` · `lib/auditNotify.ts` · `prompts/audit-agency.ts` ·
`prompts/audits-answer.ts` · `components/AuditReport.tsx` (**Audits and the Calendar**) ·
`components/DocumentReport.tsx` (**four sections**) · `lib/documentStatus.ts` · `lib/ask/documentsBrief.ts` ·
migrations **093** (the view) and **094** (the word).
