# Handoff — from the HR section

**Version:** 4 · **Updated:** 9 October 2026: §2 the release and the second paid check; §7 item 1 done; §8 a new row (§184). Version 3: 9 October 2026: §7 item 3, the morning after, done with its facts. **Version 2:** 8 October 2026, late evening: checked fact by fact against the repository at `34969a4` by
Claude Code; six facts corrected (each says so); the production paid check recorded (§2); §183's two changes (the
wait, the closing offer) added. **Version 1:** 8 October 2026, evening (Pacific), by the HR chat at the close of HR's build.
**Supersedes:** nothing. This is the close-out file that `docs/HR-PLAN.md` step 14 calls `HANDOFF-HR.md`; the
owner named it "handoff from HR", so this is that file.
**For:** the next section's chat, any later HR chat, and Claude Code. Read it first, then the files it points to.
**Checked against:** the repository at `e237751` (local, 8 October 2026), the docs listed in §1, and the owner's
production check. Where this file and the repository disagree, the repository wins: say so and correct this file.

---

## 0. In one paragraph

The new HR section is **live on production** at `https://compliboard.vercel.app/hr` since the deploy of
8 October 2026, 21:08 UTC. A company adds its employee handbooks. HR reads them, answers questions with the
handbook passage and the law side by side, checks every quote and link in code, writes a summary of each
conversation, and checks each handbook against the rules the night it arrives and every 90 days after. It runs on
Opus 5.5 at full power. One small step (11b, "Add a handbook" on the Ask tab) is built and committed but **not yet
pushed**. The quality tests (the yardstick), the manual sets and every HR switch are **held for the finish line**
(`docs/TEST-AT-FINISH-LINE.md`, HR part). §7 lists what is left, in order.

---

## 1. Read these, in this order

| File | Why |
| --- | --- |
| `CLAUDE.md` | The project rules. §3.4a (Haiku for building, the `npm run haiku` guard), §3.7 (no reset or restore without the owner), §3.11, §9.1 |
| `docs/HR-PLAN.md` (v19) | HR's plan: the owner's vision (§2.1), every decision 1–32 (§2.3), the steps (§2.4), the switches in order, and each decision's effect on other sections (§2.6) |
| `docs/DECISIONS.md` §164–§182 | Every HR step: what was built, what was proved, what it cost |
| `docs/TEST-AT-FINISH-LINE.md` | Everything HR leaves for the end, in blocks A–J. Every section adds its own part in the same shape |
| `docs/TESTING.md` | HR's manual sets: steps 3a to 11b, V-1 to V-5, A-1 |
| `docs/RELEASE.md` | How a change reaches production; what Vercel holds (the only authoritative list) |
| `STATUS.md` | The HR row |
| `docs/HANDOFF-CODE.md` §7 | Open defects, including HR's |
| `docs/HR-MACHINERY.md` | The 4 October map of OLD HR and everything it touched. Old HR is gone; the map's "B" numbers are still cited by the decisions |
| `docs/HANDOFF-WORKSPACE-TO-HR.md` | The handoff HR started from. Its §6–§8 (product rules, how we work, traps) still apply to every section |

**The owner's canvas** (every HR screen was drawn here first): "CompliBoard HR Workspace — the feature boards",
https://claude.ai/artifact/F4z7voVgDeRxKg8E8fvtjJ (version 13; boards 1–12, 2b and 11b). Three boards no longer
match the build, see §7 item 5.

---

## 2. Where HR stands tonight

**On production** (`https://compliboard.vercel.app`):
- **The code:** `804d85e` (the go-live), released with the docs commits `073e900` and `c081bdf`. Deploy live at
  21:08 UTC on 8 October.
- **The database:** migrations `000`–`072` on both staging and production. `npm run preflight` read 0 pending at
  the go-live release.
- **Vercel settings HR depends on** (values in `docs/RELEASE.md`):
  - `AI_MODEL_HR` and `AI_MODEL_HR_CHECK` = `claude-opus-5-5`, saved visible, added by the owner at the go-live;
  - `RESEARCH_PROVENANCE`, `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST` = `true`, visible. HR's prompt is built from
    the workspace's, so these three shape HR's answers too;
  - `AI_EFFORT` = `medium`;
  - **deliberately NOT set:** `HR_ANSWER_USES_CHECK` (a switch, off), `AI_SEARCH_MAX_HR` (unset means no search
    limit). The finish line decides both.
  - `HR_PREVIEW` no longer exists in the code. Old lines in the owner's `.env.local` are harmless.
- **The free live checks after the deploy passed:** `/hr` 200 with the new page; `/hr/new`, `/api/hr` and
  `/api/hr-audits` 404; `POST /api/hr/answer` with no login 401.
- **The owner's paid check passed** (8 October, evening). Recorded by §183 (`DECISIONS.md`, `STATUS.md`,
  `docs/TEST-AT-FINISH-LINE.md` H), from two read-only production queries.
  - As CB-Test-3, the owner added `tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf` and asked: "What does
    this handbook say about food worker cards, and does it match Washington's rule?"
  - The whole chain worked on production: the reading, the answer on Opus, the company context, sources from
    Washington government sites, the day-1 line.
  - The answer opened by saying the handbook does not appear to be the company's (CB-Test-3's record is an Oregon
    sawmill). That is right. It listed four gaps (30 days should be 14; servers and bussers are not exempt; cards
    are valid statewide; keep copies) and said the $10 fee was correct. The facts look right; the finish line
    judges them.
  - **Sources (read from production's `turns.sources`): all five are web pages, all labelled official.**
    WAC 246-217 (app.leg.wa.gov), doh.wa.gov's Food Worker Card page, WAC 246-217-015 (a lawfilesext.leg.wa.gov
    PDF), clallamcountywa.gov and kingcounty.gov. **No "your handbook" card**: the answer described the handbook in
    its own words rather than quoting it. That is the known gap behind switch 3 (§9).
  - **Its ledger row:** `hr`, `claude-opus-5-5`, effort medium, 2 searches, 25,061 tokens in and 2,236 out,
    $0.164964, 26 seconds (22:40:23 UTC). The reading's outline call was `hr_check` on Opus, $0.013804.
  - **Two findings:**
    - It closed by offering to "start a compliance checklist for your sawmill in Portland". **HR has no
      checklist.** The cause is `RESEARCH_SPECIALIST`'s last sentence, "End with one specific offer of what you
      could do next", which HR inherits from the workspace's prompt (`prompts/checklist.ts:281–285`,
      `RESEARCH_SPECIALIST_BLOCK`; *corrected in v2: v1 cited `docs/RELEASE.md`, which does not contain it*).
      **Answered by §183:** one sentence in HR's own prompt (§4.3).
    - It drifted into the sawmill's general priorities ("your priorities are Oregon OSHA…"), which the person did
      not ask about. Likely the same inherited paragraph.
  - **The read-only follow-up came back** (the five sources and the ledger row above; §183).

**Released 9 October (§184):** 11b (`4aac9c3`, §182) and §183 (`34969a4`), pushed as `cd6a55d`, live from
15:58:58 UTC, told apart by "Add a handbook" in `/hr`'s HTML (0 matches, then 1).

**The owner's second paid check passed** (§184), as CB-Test-3: Harbor deleted, added again from the Ask tab, "Do our
servers need a food worker card before their first shift?" asked at once. The answer used Harbor (given as pages,
text first; it waited 0 s, as its text was already saved), stayed on the handbook, and closed with "If you'd like, I
can write replacement wording for Section 1…", an offer HR can keep. The day-1 line showed. 4 official web sources,
no handbook card (switch 3's gap). The answer: `hr`, `claude-opus-5-5`, effort medium, 2 searches, $0.167272.

**Tests:** 960 at `34969a4` (`npm run check`; the floor is committed in `scripts/test-guard.js`).

**Spent on Opus so far:** the machinery run before the go-live, **$4.62** (`docs/TEST-AT-FINISH-LINE.md` HR C); the
Step 9 side-by-side, **$3.98** (§177); the owner's own runs. Every build stop ran on Haiku.

---

## 3. What HR is (the owner's vision, as built)

HR is the Compliance Workspace with the company's handbooks as the evidence. Same page, same buttons, same
places. Three tabs: **Ask a question · Conversations · Handbooks**. (A fourth, Dates, is built and hidden; it
returns with the structured check, §9.)

A person asks about their policies or a situation at work. The answer reads the handbooks for that site, checks
the rule at the agency with web search (official pages first), and says the gap, why it is a gap, the source on
both sides, and how to fix it, in plain words. **There is no checklist and there are no execution steps in HR.**

A question asked straight after upload is answered from the handbook itself, with a grey line saying the full
check has not run yet. Conversations are summarised by the person or the same night. Full conversations are
deleted 12 months after the last message; summaries stay until deleted. Each handbook is checked the night it
arrives and every 90 days, and the person is told that date plainly.

**The words:** never "compliant", never "AI" or a model's name, no cost on a customer screen, not legal advice.
Short, plain sentences.

**Handbooks are HR's own.** They live in HR's tables and storage, never in Company Documents. Documents, its sweep,
the dashboard and Audits cannot see them. (Accepted by the owner: Audits will not cite a handbook.)

---

## 4. How it works, end to end

### 4.1 Adding a handbook
- **"Add a handbook"** sits on the Handbooks tab and, from 11b, on the Ask tab (the workspace's attach slot). Both
  call one function, `addHandbook()` in `app/hr/HrWorkspace.tsx`.
- With two or more sites, the site sheet asks which site the handbook covers ("Every site" or one site) BEFORE
  anything is uploaded. "Not now" leaves nothing.
- The file is stored at `<company>/handbooks/<file>` in the `company-documents` bucket (`handbookPath()`). Exactly
  two levels deep, because account delete's storage walk goes only two levels (`app/api/account/route.ts`).
- `POST /api/handbooks` saves the row as the person. If the row fails, the page removes the file.
- **Versions:** a newer version keeps the name, scope and site. Every version is listed; older ones read "Older
  version · <file> · added <date>". Only the current version is used for answers and checks.
- **Delete** (`lib/handbookDelete.ts`): the file first, then the row; checks cascade; the version chain is relinked.
- **"Choose where it applies"**: for a handbook whose site was deleted. Current version only; it moves every older
  version with it (`PATCH /api/handbooks`, `setHandbookSite`). An older version's id gets a 400.

### 4.2 Reading
- Starts right after the row saves, and on "Read it again". `lib/handbookStart.ts` claims the row, replies, and
  reads in `after()`, so a closed tab loses nothing.
- **From inside an answer that is waiting (§183):** `startReadingNow()`, the same claim with the reading started at
  once. `after()` runs its work only once the response has finished, and the answer's response is the stream that
  waits, so `after()` there only keeps the running reading alive.
- **Text first:** the text is saved before the sections are found, so a question can be answered at once.
- **Word** handbooks are cut at their own headings in code, with no model call. They show no pages.
- **PDF** handbooks get one outline call per part of up to 120,000 characters (`prompts/hr-outline.ts`, ledger
  `hr_check`). Code cuts at the anchors the model names.
- **The coverage proof:** the sections joined must equal the whole text, no gap and no overlap, or the reading
  fails with our-fault words.
- Fewer than 20 letters a page, on average, is a scan (`SCAN_LETTERS_PER_PAGE`, `lib/handbookSections.ts:160`), and
  stops before any model call. *(Corrected in v2: v1 said "a page with fewer than 20 letters".)*

### 4.3 The answer (`POST /api/hr/answer`, ledger `hr`)
- **The prompt** (`prompts/hr-answer.ts`): `hrAnswerPrompt()` = the workspace's own
  `buildSystemPrompt('research', null, { open: true })` plus two sentences: `HR_GIVEN_SENTENCE`, "You are given the
  company's handbooks, section by section, and what is known about the company.", and, since §183,
  `HR_OFFER_SENTENCE`, "Stay with the handbooks and the employment rules they touch. If you end with an offer, offer
  only what you can do here: explain a rule, compare a handbook section with it, or write suggested wording for the
  handbook." A unit test holds the prompt equal to that in all eight on/off combinations of the research switches.
  **So any change to the workspace's research prompt changes HR's answers.** The handbook check uses the same prompt.
- **The message:** the company context (sites, declared and confirmed facts), then the handbooks, then the question.
- **Whole handbooks when they fit:** `HR_HANDBOOK_BUDGET_TOKENS`, default 650,000 tokens on Opus, about 1.6 million
  characters at 0.4 tokens a character. Above that, one selection call (`prompts/hr-select.ts`) plus a code safety
  net picks the sections. If a long handbook's sections are not found yet, **the honest wait** shows "<done> of
  <total> parts done" and carries on by itself (up to 3 minutes).
- **The wait for a handbook still being read (§183):** an answer never goes ahead without a current handbook whose
  text is not saved yet. It waits inside the request (every 2 seconds, the same 3-minute limit), starting a reading
  if none is running, and says "Reading <handbook> first. Your answer starts as soon as it's read." If that reading
  fails and it was the only handbook: "We couldn't read your handbook: <reason>. Your question was not answered
  yet." With others: the answer goes ahead, closing with a grey "<handbook> could not be read, so this answer does
  not use it. The Handbooks tab shows why." 
- **Web search, no limit**, as the workspace's research answer.
- **Checked in code after the call. The checks never change Claude's words:**
  - a quoted passage found in a handbook gets a card: "<handbook> — <section>, page <n> · your handbook";
  - a quoted passage of six words or more found nowhere is kept and followed by a small grey
    "(not a quote from your handbook)";
  - each link is checked against the pages this answer's search returned (`findReturned`) and labelled official or
    other.
- **The day-1 line:** "Your handbook's full check has not run yet. This answer reads the handbook and the rule just
  now."
- **The check record:** `turns.check_record` (migration 069) stores what the answer was given, the pages its search
  returned, each card's origin and what was dropped, so an answer can be audited later.
- **Refusals with no model call:** no handbook yet; none could be read. ("Still being read" is no longer a refusal
  since §183: the answer waits.)

### 4.4 Conversations and the summary
- HR conversations are `topics` with `section = 'hr'`; each list shows only its own section.
- The drawer, reopening, "Not answered." with "Ask it again", and delete (sheet with "Download the summary" first)
  are the workspace's, with HR's words.
- **"Summarise this conversation"** (`POST /api/hr/topics/[id]/summarise`): claim, 202, write in `after()`.
- **One summary writer** for both sections: `summariseTopic(…, { kind: 'hr' })` in `lib/summaryReport.ts`, with
  `prompts/hr-summary.ts`. HR's headings: "What to change · <n> things".
- **Facts** are proposed only from the person's own words, into Company information's one queue, labelled with the
  conversation's title.

### 4.5 The handbook check (`lib/handbookCheck.ts`, ledger `hr_check`)
- **Started by** "Check now" (`POST /api/hr/handbooks/[id]/check`) or the night queue (§4.6). One open check per
  handbook (a unique index, migration 071).
- **Each piece is an open HR answer** to one fixed question: "Check this handbook against the rules that apply to
  us. What needs to change, what's missing, and what's unclear?" A piece is the whole handbook when it fits;
  otherwise consecutive sections, each with the whole table of contents. The answer and its sources are stored on
  the piece (migration 072).
- **The sweep** (`/api/jobs/handbook-checks`, every 5 minutes, copied from Audits): recover stuck claims, one
  company at a time, a 510-second budget. A failed piece is retried once. A newer version cancels the old check; a
  delete stops it.
- **When it finishes:** `checked_at`, and `next_check_at` 90 days on. A check where every part failed is "failed",
  with no dates. The drawer draws each part exactly as an HR answer.
- **The email** (`lib/handbookCheckNotify.ts`, copied from Audits): only when a person pressed Check now, once, to
  that person. Its link opens `/hr?handbook=<id>` (`HR_PAGE_PATH`). The night queue's checks send nothing.

### 4.6 The night (`vercel.json`, all UTC)
| Job | When | What |
| --- | --- | --- |
| `/api/jobs/summarise` | 10:00 | Summaries of conversations quiet 6 hours or more, workspace and HR |
| `/api/jobs/delete` | 10:30 | Clears transcripts 12 months after the last message |
| `/api/jobs/handbook-queue` | 10:00 | Queues each current, read handbook that is new (`new_handbook`), a new version (`new_version`), or past `next_check_at` (`scheduled`) |
| `/api/jobs/handbook-checks` | every 5 min | The handbook sweep |

10:00 UTC is 3 am Pacific in summer, 2 am in winter. The night queue and the sweep both write `job_runs` rows
under the job name `handbook_checks`; `counts.job` says which wrote it (`'queue'` for the night queue).

### 4.7 Models and the ledger
| Task | Ledger | Setting | Production |
| --- | --- | --- | --- |
| HR answers, section choice | `hr` | `AI_MODEL_HR` | `claude-opus-5-5` |
| Handbook check, PDF outline | `hr_check` | `AI_MODEL_HR_CHECK` | `claude-opus-5-5` |
| HR summaries | `summarise` | `AI_MODEL_SUMMARY` | `claude-opus-5-5` |

**Building on Haiku:** every model-capable command of Claude Code's goes through `npm run haiku -- <command>`. It
forces Haiku and refuses to start if any tier is not Haiku, and sets the handbook budget to 120,000 for Haiku's
smaller window.

---

## 5. The code map

**Page:** `app/hr/page.tsx` renders `app/hr/HrWorkspace.tsx` (the whole client page, ~1,150 lines).

**Routes**
| Route | Does |
| --- | --- |
| `app/api/handbooks/route.ts` | POST add, PATCH "Choose where it applies", DELETE |
| `app/api/handbooks/read/route.ts` | POST "Read it again" |
| `app/api/hr/answer/route.ts` | POST an answer (streamed) |
| `app/api/hr/handbooks/[id]/check/route.ts` | POST "Check now" |
| `app/api/hr/topics/[id]/summarise/route.ts` | POST "Summarise this conversation" |
| `app/api/jobs/handbook-queue/route.ts` | GET (Vercel cron) / POST (by hand): the night queue |
| `app/api/jobs/handbook-checks/route.ts` | GET / POST: the sweep |

Every one declares `maxDuration = 800`. Conversations reuse `/api/topics/[id]` unchanged.

**Libraries and prompts**
| File | Does |
| --- | --- |
| `lib/handbooks.ts` | The words and list helpers: `counted`, status words, `siteRemovedLede`, `CHOOSE_WHERE`, `checkingSections`, `uploadLede` |
| `lib/handbookSave.ts` | Saving a row and its version; `setHandbookSite` |
| `lib/handbookDelete.ts` | Deleting a version and relinking the chain |
| `lib/handbookStart.ts` | Claim, then read in `after()` |
| `lib/handbookRead.ts` | The reading: text, outline, claim |
| `lib/handbookSections.ts` | Cutting, `PAGE_BREAK`, the coverage proof, scan detection |
| `lib/hrAnswer.ts` | The answer: loading handbooks, budget, section choice and safety net, `checkQuote`, the check record |
| `lib/hrAnswerWords.ts` | The answer's fixed sentences: refusals, the wait, the grey mark |
| `lib/hrSummary.ts` | HR's summary sources (handbook passages) |
| `lib/handbookCheck.ts` | The check: pieces, the sweep, claims, retries, finish |
| `lib/handbookCheckView.ts` | What the check drawer shows |
| `lib/handbookCheckNotify.ts` | The email; `HR_PAGE_PATH = '/hr'` |
| `prompts/hr-answer.ts` | `hrAnswerPrompt`, `HR_GIVEN_SENTENCE`, `hrAnswerMessage` |
| `prompts/hr-outline.ts`, `prompts/hr-select.ts`, `prompts/hr-summary.ts` | The outline, the section choice, the summary |

**Migrations** (all on staging and production)
| # | Adds |
| --- | --- |
| 066 | `handbooks`, `handbook_sections`, `handbook_checks`, `handbook_check_sections`, `handbook_findings`, `handbook_dates`; `topics.section`; `calendar_events.handbook_id`; the `hr`/`hr_check` ledger tasks; the `handbook_checks` job name |
| 067, 068 | Hardening for every section: people lose TRUNCATE, TRIGGER, REFERENCES and MAINTAIN; `postgres`'s defaults grant them nothing |
| 069 | `turns.check_record` |
| 070 | `handbooks.outline_parts_total`, `outline_parts_done` (the honest wait) |
| 071 | The check's run columns, `cancelled`, one open check per handbook, `notified_at` |
| 072 | The check stores each piece's answer, sources and check record |

**Tests:** 16 files at `34969a4`, `tests/unit/hr*.test.ts` and `tests/unit/handbook*.test.ts`. `check:live` has HR probes
(the six tables, storage, and the live routes).

**Parked, never pushed:** the local branch `parked/hr-check-structured` (`391fd05`): the structured check, with
per-section words, "not covered", "still to confirm", the dates and "Add to calendar".

---

## 6. What HR changed outside HR, and the shared files

**The cross-section rule** (DECISIONS §180): a section that changes a shared file before the finish line re-runs
the free checks (`npm run check`, `check:live` on 3999) of every section that uses it.

**Shared files HR depends on** (also in `docs/TEST-AT-FINISH-LINE.md` HR J):
- `prompts/checklist.ts` `buildSystemPrompt`: **HR's answer prompt is built from it.** A change to the workspace's
  research prompt changes HR's answers. So HR's yardstick runs after the workspace's last prompt change.
- `prompts/summary-report.ts`: HR's summary prompt copies two of its paragraphs word for word; a test pins them.
- `lib/pipelineConfig.ts` (the research switches); `lib/ai.ts` (`citedPassages`, `searchLimit`).
- `lib/summaryReport.ts`, `lib/summaryWords.ts`, `lib/listWords.ts`, `lib/topicList.ts`, `lib/topicClaim.ts` (the
  6-hour quiet rule), `lib/conversation.ts`.
- `lib/documentScan.ts` `normaliseForQuote`; `lib/howTo.ts` `findReturned` and `labelFor`.
- `components/AnswerBody.tsx`, `ReportView.tsx`, `ConversationList.tsx`, `Stages.tsx`, `stageWords.ts`,
  `Drawer.tsx`, `Sheet.tsx`, `Tabs.tsx`, `buttonStyles.ts`; `lib/printFrame.ts`.
- `vercel.json`.

**What HR changed that other sections now carry:**
- The workspace's display pieces were lifted into shared files (3a, 4a), measured unchanged.
- The night jobs moved to 10:00 / 10:30 UTC and the quiet rule to 6 hours (workspace summaries too).
- One sentence in the workspace's summary prompt (§173): an empty "situation" when the person said nothing.
- Migrations 067 and 068 hardened grants on every table.
- `scripts/schema-doc.js` reads real grants; `docs/SCHEMA.md` shows them.
- Account delete and export cover HR's tables and files.
- `calendar_events.handbook_id` exists (nothing writes it while the Dates feature is parked).

---

## 7. What is left, in order

1. ~~**Release 11b, and decide the closing offer.**~~ *DONE: Option A, built in §183; released with 11b on
   9 October (`cd6a55d`, §184).* **Still open after it:** the canvas (item 5, the HR chat), the two proposed
   switches (item 6, the owner), and the owner's housekeeping (item 7).
   - 11b (`4aac9c3`, `e237751`) is committed and not pushed.
   - The decision: HR answers inherit "End with one specific offer of what you could do next", and on production
     that became "start a compliance checklist", which HR does not have. **Option A:** one sentence in HR's own
     part of the prompt (`HR_GIVEN_SENTENCE`, `prompts/hr-answer.ts`), saying what HR can offer (explain, compare
     with the rule, write suggested wording). Never in the shared `prompts/checklist.ts`. It is a quality change,
     so it needs the owner's yes; the finish line measures it. **Option B:** leave it, and add it to the finish
     line's list of things to judge.
   - Then one release (`docs/RELEASE.md`): `check:live` on 3999, `npm run preflight` (expect 0 pending; 11b has no
     migration), push, the free live checks (`/hr` 200), then the owner signs in and sees "Add a handbook" under
     the box on the Ask tab.
2. ~~**Record the production paid check in the repository**~~ *Done by §183's docs.* (§2): `docs/TEST-AT-FINISH-LINE.md` H ("Still the
   owner's: the one paid check" is now done), `STATUS.md`'s HR row ("still to come"), and the closing-offer finding
   in the finish line's E. Include the follow-up report's facts if it came back (the five sources by kind, the
   ledger row's model and effort).
3. **The morning after** (HR-PLAN step 14) — **DONE 9 October 2026; the facts are below the queries.** Any time after 3:30 am Pacific on 9 October. Claude Code, read-only,
   one stated need each, SQL printed (`CLAUDE.md` §3.7):
   ```sql
   select job, started_at, finished_at, ok, counts, errors
     from public.job_runs
    where job in ('summarise', 'delete', 'handbook_checks')
      and started_at > now() - interval '1 day'
    order by started_at;
   ```
   ```sql
   select h.name, h.status, h.checked_at, h.next_check_at,
          c.reason, c.status as check_status, c.done_count, c.section_count,
          c.finished_at, c.requested_by is null as nightly
     from public.handbook_checks c join public.handbooks h on h.id = c.handbook_id
    where c.created_at > now() - interval '1 day'
    order by c.created_at;
   ```
   **What must be true:** a `summarise` row after 10:00 UTC that now includes HR conversations (CB-Test-3's
   food-worker-card conversation should read "Summary ready", the first HR summary on production); a `delete` row
   after 10:30 UTC; `handbook_checks` rows from the queue (`counts.job = 'queue'`) and the sweep; the Harbor
   handbook's check `new_handbook`, done, `next_check_at` 90 days on, no email. All `finished_at` set. Estimated
   cost of the night: about $0.20 for the check and about $0.20 for the summary, on Opus.
   **The result (9 October), read-only, the Supabase CLI's own connection:**
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
4. **The close-out docs** (step 14). This file is the handoff. *Done by §183's docs commit, except the morning
   after's own record.* Then:
   - `docs/HR-PLAN.md` step 14: point to this file instead of `HANDOFF-HR.md`; mark 11b done.
   - `docs/README.md`: list this file.
   - `STATUS.md`: the HR row (live, paid check passed, 11b).
   - `docs/RELEASE.md`: three lines still describe HR as off. The cron table says "HR's while `HR_PREVIEW` is on"
     and "404 until HR is released" for both HR jobs; the morning-after paragraph says neither HR job writes a row
     "while HR is off"; the free checks line says "`GET /hr/new` → 404 while HR is off".
   - `docs/HANDOFF-CODE.md`: §7's orphan-file row still names `app/hr/new/HrWorkspace.tsx` (now
     `app/hr/HrWorkspace.tsx`); §1 and §2 still describe 4 October (git at `fd2ddfa`, migrations to 065).
5. **The canvas.** Bring it in line with the build:
   - board 4 (the structured check) shows what is parked;
   - board 7 has a "Draft new wording for 7.2" button that was never built;
   - board 8 shows an answer using the stored check, a switch that is off;
   - boards 5, 7 and 8 lack 11b's "Add a handbook" in the attach slot.
6. **Two proposed switches, for the owner's yes or no** before they go into HR-PLAN (`docs/TEST-AT-FINISH-LINE.md`
   HR G): cheaper splitting or section choice for very large handbooks (only if the finish line's 120-page check
   shows the cost needs it); Sonnet 5.5 against Opus 5.5, per task, by measurement.
7. **Housekeeping for the owner's laptop:**
   - the `HR_PREVIEW=1` lines in `.env.local` (twice) can go; nothing reads them;
   - ~~`.git/stale-maintenance-lock-from-claude`~~ deleted by Claude Code with §183;
   - the repository sits in an iCloud-synced Desktop, which once created a stray `main 2` ref; consider moving it.

---

## 8. Known defects and limits

| What | Where | Status |
| --- | --- | --- |
| HR answers can offer a checklist HR does not have | `RESEARCH_SPECIALIST` via `prompts/checklist.ts`; HR's prompt | Found on production 8 October. §7 item 1 |
| Handbook words written without quotation marks get no card | `lib/hrAnswer.ts` | Known; switch 3 (§9). Seen again on production |
| A page left open across a night check shows the old row ("Not checked yet") and the drawer's old top line ("added <date>") until reloaded, while the drawer's body shows the new check | `app/hr/HrWorkspace.tsx`: the rows and `loadRowChecks` are loaded once, and again only while a reading or a check is open; the drawer loads the check fresh each time | Seen by the owner, 9 October. OPEN, `HANDOFF-CODE.md` §7. Cheap fix for later: reload the rows when the drawer finds a newer check, or when the person comes back to the tab |
| Internal section labels "(H5, H8, H10)" seen in a Haiku answer **while it streamed** | `app/hr/HrWorkspace.tsx:352` (`hideHandbookMarkers` while streaming); the replacement is `lib/hrAnswer.ts:532` `replaceBlockIds`, run when the answer finishes (`:523`) | **Checked (§183), v1's hypothesis is wrong:** `replaceBlockIds` does replace a bracketed list ("(H5, H8, H10)" becomes three titles), and the saved 11b answers hold no bare id. The screenshot was taken mid-stream, where only `[H…]` markers are hidden, so bare ids show until the answer finishes. OPEN, not fixed |
| A stopped or cut-off answer writes no ledger row, though it is billed | `lib/ai.ts` | OPEN, `HANDOFF-CODE.md` §7. The workspace is likely the same |
| A handbook file can be left in storage with no row if the tab closes mid-add | `app/hr/HrWorkspace.tsx`, `app/api/handbooks/route.ts` | OPEN, §7. Invisible; account delete still removes it |
| A summary's as-of date is UTC; the print header is local | `lib/summaryReport.ts`, `components/Drawer.tsx` | OPEN, §7 |
| A heading can sit alone at the foot of a printed page | `components/ReportView.tsx` (workspace and HR) | OPEN, §7 |
| Audits re-queues a crashed section with no limit (HR's copy stops after one retry) | `app/api/jobs/audit-sections/route.ts` | OPEN, §7. Found by HR |
| Account export leaves out conversations | `app/api/account/export/route.ts` | OPEN, §7 |
| `anon` and `authenticated` may execute any new function by default | `pg_default_acl` | OPEN, §7 |
| "Try again" after "This answer stopped early" never clicked on a real answer | V-2 | For the finish line |
| A cited web passage is about 150 characters, so a longer quote of law is not matched | Anthropic's limit | Accepted; the safe direction |
| Word handbooks show no pages | by design | Accepted by the owner |
| The handbook's dates and "Add to calendar"; the Dates tab | parked with the structured check | Returns with switch 5 |

---

## 9. Held for the finish line

All of it is in `docs/TEST-AT-FINISH-LINE.md`, HR part, blocks D to G. In short:
- **The yardstick (D, E):** Test Alpha with a Washington site added; mismatched handbooks deleted first; the owner's
  real handbook on staging only (never in the repository) or a synthetic one that fits, plus a synthetic Washington
  addendum; about eight real questions with keys written before any run; three runs each; Opus 5.5 at production
  settings (block B). Add to what is judged: no offer of anything HR does not have.
- **The manual sets (F):** every "Manual set — HR …" in `docs/TESTING.md`, V-1 to V-5 and A-1; rows the baseline
  replaced are marked superseded.
- **The switches, one at a time against the baseline (G):** prompt caching; answers use the stored check;
  cards for handbook words without quotation marks; the structured check; suggested wording as a draft; the
  quote-marker form. Plus the two proposals in §7 item 6.

---

## 10. Test data

- **Staging:**
  - Test Alpha Chemical (`testalpha@example.com`; Hillsboro and Portland, Oregon), the yardstick's company;
  - testgamma (one site; holds the 120-page synthetic handbook);
  - testcascade;
  - staging's handbooks are mostly other businesses' (Harbor Kitchen and others), which is why answers say "this
    isn't your handbook". Clean before the yardstick;
  - the 12 Opus conversations from Step 9's side-by-side are kept.
- **Production:** CB-Test-3 now holds the Harbor handbook and one HR conversation. Its company record is an Oregon
  sawmill, and its confirmed documents name other businesses: test data, not a bug.
- **Fixtures:** `tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf` (2 pages, planted errors).
- **On staging only, not in the repository** (*corrected in v2: v1 listed them as fixtures*): the 120-page synthetic
  PDF (Test Gamma's Cascade handbook) and the 70-page synthetic handbook with a bereavement rule on page 59 (the hard
  case for section choice).

---

## 11. How the HR chat worked, and the lessons worth carrying

- **One instruction at a time,** in one code block, with two or three lines on what to look for. The owner pastes
  Claude Code's report back.
- **The impact check comes before any code,** and names every file in another section it would touch. A task whose
  effect on another section is not in the plan stops before writing code. The rule has been in HR-PLAN §2.5 since
  7 October (§168); Claude Code broke it once, in step 11a, and the owner restated it. *(Corrected in v2.)*
- **Quality changes are labelled as such** and wait for the owner's yes. Everything else is machinery, proved on
  Haiku.
- **The owner tests on Opus; Claude Code builds on Haiku**, through the guard.
- **Docs are written from the repository, never from memory.** The first finish-line doc had six mismatches written
  from memory; Claude Code's check found them.
- **Verify a write, don't trust the tool's word.** A file "written" to the owner's laptop through the device link
  was not on disk; md5 on the laptop settled it. Git commands through the link can leave lock files.
- **Production's address is `https://compliboard.vercel.app`.** `app.compliboard.com` does not exist.
- **A check that cannot see anything looks like a check that found nothing.** Migration 070's first verify block
  skipped its test on an empty table and still said it passed.
- **A feature that is parked must leave the canvas too,** or the boards stop describing the product.

---

## 12. For the next section's chat

HR leaves you these patterns, built and proved:
- **A section's own document store:** its own table, and its own folder exactly two levels deep in the company's
  storage (`<company>/handbooks/<file>`), invisible to Documents (§4.1).
- **Reading with a coverage proof:** text first, sections cut in code, the joined sections must equal the text.
- **Quotes and links checked in code without changing the model's words:** a card when found, a grey mark when
  not, links labelled official or other.
- **A check record stored with every answer,** so it can be audited later.
- **The honest wait:** progress read from the database, shown as it happens.
- **A night queue plus a 5-minute sweep,** with claims, one retry, and an email only when a person asked.
- **Switches, off by default,** for every quality idea, measured once at the finish line.

And two things to do yourself: add your section's part to `docs/TEST-AT-FINISH-LINE.md` in the same shape (A to J),
and list your shared files under your J, so the cross-section rule can work.
