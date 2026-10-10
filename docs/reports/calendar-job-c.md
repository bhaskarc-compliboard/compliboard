# CALENDAR JOB C — DATES IN WORKSPACE AND HR SUMMARIES

Plan decision 13, board 10. **A quality change** (`CLAUDE.md` §3.1): the prompt paragraph is the
owner's, word for word. Built and proved on Haiku (`npm run haiku -- …`); the owner tests on Opus.

**Ledger at the start of this job: 349 calls, $19.03.** This job's spend is the difference.

---

## C0 — THE IMPACT CHECK, BEFORE ANY CODE

`lib/summaryReport.ts` is the single most shared file in the product: **both** the Compliance
Workspace and HR Workspace summarise through it, and a third caller (the nightly job) drives both.
Everything below was read, not remembered.

### What this job changes, and who else holds it

| file | section | why it is touched | who else depends on it |
|---|---|---|---|
| `prompts/summary-report.ts` | Workspace | the dates shape + the owner's paragraph | `lib/summaryReport.ts` only |
| `prompts/hr-summary.ts` | HR | the same, identically | `lib/summaryReport.ts`, `tests/unit/hrSummary.test.ts` |
| `lib/summaryReport.ts` | **BOTH** | `SummaryReport.dates`, `checkReport`'s five checks, `renderPlainText`, and `summariseTopic`'s `today` | the 6 callers below |
| `components/ReportView.tsx` | **BOTH** | board 10's dates block | `app/compliance/page.tsx`, `app/hr/HrWorkspace.tsx` |
| `lib/calendarDates.ts` | Calendar | nothing new — `addDate` already takes `source: 'conversation'` and `topicId` | the calendar page, the route |

### The six callers of `lib/summaryReport.ts`, by section

| caller | section | what a shape change does to it |
|---|---|---|
| `app/api/topics/[id]/summarise/route.ts` | Workspace | passes turns through; **no change needed** |
| `app/api/hr/topics/[id]/summarise/route.ts` | HR | same |
| `app/api/jobs/summarise/route.ts` | **both** (nightly) | same; it drives Workspace *and* HR topics |
| `app/compliance/page.tsx` | Workspace | renders `ReportView`; gains the dates block through it |
| `app/hr/HrWorkspace.tsx` | HR | same |
| `lib/checklistConvert.ts` | Workspace | imports **only** `gatherSources`, `checkCitations`, `cleanSourceNumbers` and two types — **not** `checkReport` and not `SummaryReport`. A field added to the report cannot reach it. Verified at `lib/checklistConvert.ts:17–18`. |

### The tests that pin the shared pieces

`tests/unit/summaryReport.test.ts` · `tests/unit/hrSummary.test.ts` ·
`tests/unit/checklistConvert.test.ts` · `tests/unit/checklistView.test.ts` ·
`tests/unit/clientImports.test.ts` · `tests/unit/topicClaim.test.ts`

> **`hrSummary.test.ts:89` asserts the HR prompt `endsWith` the facts paragraph.** The owner's
> instruction puts the dates paragraph **directly before** "About the facts:", so that assertion
> stays true — and stays worth having, because it is what would catch the paragraph being appended
> in the wrong place.

### Both sections' free checks, to be re-run at C5

`npm run check` (after every checkpoint, floor only up) · `CHECK_LIVE_BASE_URL=http://localhost:3999
npm run check:live` · `/compliance` and `/hr` both load and show their rows, `BLOCKED` printed ·
the nightly `summarise` job by hand.

### One thing C0 found that the brief did not name

**`summariseTopic` gives the prompt a UTC day**, not the company's:

```
lib/summaryReport.ts:442   const today = args.today ?? new Date().toISOString().slice(0, 10)
```

The brief requires the prompt's "today" to be the company's (B10's zone), and that line is the only
place it is produced for all three callers. It becomes `today(zoneForState(state))`, read inside
`summariseTopic`, which already has `companyId`. **No caller changes.**

### What this job does NOT touch

- **No migration.** `calendar_events` already carries `topic_id` and `source = 'conversation'`
  (073). Decision 2's key means pressing "Add to calendar" twice is one date.
- **No new writer.** Adding goes through `addDate`, as the calendar page does.
- **Documents and Audits.** Their summaries are a different path; their "read on <date>" lines stay
  on the server's day (Job E, `docs/HANDOFF-CODE.md` §7).

### Stop items

**None.** Decision 13 is in the plan, the prompt paragraph is approved word for word, and the shape
change is additive — an older stored report with no `dates` field renders exactly as it does today.

---

## C4 — THE PROOF, ON HAIKU, AGAINST REAL STAGING CONVERSATIONS

`scripts/calendar-c4-dates.mjs`: real turns off staging, the product's own prompt, the product's own
`checkReport`. **Nothing is written** — no topic updated, no date added.

> ### THE FIRST RUN RETURNED AN EMPTY LIST FOR ALL FOUR CASES, AND I ALMOST FILED THAT AS A RESULT.
> Two of the four were chosen *for having deadlines*. Four empty answers is either right four times
> or a pipeline that cannot see — and the two look identical (§9a). So a **case 0** was added: a
> deadline that is unmistakably there. If that comes back empty, nothing below it means anything.

| # | conversation | model proposed | passed the checks | right? |
|---|---|---|---|---|
| 0 | **constructed, a date plainly stated** | 2 | **2** | the presence — the pipeline works |
| 1 | Workspace · federal hazmat registration | 0 | 0 | **yes, and see below** |
| 2 | HR · Oregon paid sick time | 1 | 1 | yes |
| 3 | Workspace · OSHA HazCom standard number | 0 | 0 | yes — an empty list |
| 4 | **constructed**, a later answer withdrew the date | 0 | 0 | yes — it must not appear |

**Case 0, the presence:**
```
• Renew Air Contaminant Discharge Permit   day 2027-03-15  how often —       sources 1
  line: "Your Air Contaminant Discharge Permit must be renewed by 15 March 2027."
• Report emissions                         day 2027-02-01  how often yearly  sources 1
  line: "You also report emissions every year, by 1 February."
```
The repeat is set on the second and not the first — **check 3 doing its job on real output.**

**Case 1 is the interesting one, and it is not a miss.** The conversation contains "July 1",
"June 30", "annually" and "renewal", so zero looked wrong. Reading it settles it:

> "not all registration certificates are up for renewal by July 1" · "You should look at your
> registration certificate for the date of renewal … to know your specific deadline" ·
> **"Don't assume it's July 1 unless that's what your certificate says."**

**The conversation explicitly refuses to give this person a date.** An empty list is the correct
answer, and a model that had emitted "1 July 2027" would have invented the exact deadline the answer
warned against. Case 2's only literal date is "January 1, 2014" — when Portland's law took effect —
which the prompt says to leave out as history.

**Case 2 returned 0 dates on one run and 1 on the next.** Haiku is not deterministic, and both
answers are defensible. The one it found is sound:
```
• Sick time balance reporting due   day: none given   how often: quarterly   sources: none
  line: "You report each employee's balance at least every quarter"
```
No day, because the conversation gives none; `quarterly` because the line says "every quarter".
**The quality judgement is the owner's Opus test, not this.**

> ### AND THE SCRIPT'S FIRST FIVE CALLS WERE NOT IN THE LEDGER.
> It omitted `ledger`, so five real Haiku calls were made and `npm run cost` still read
> **349 / $19.03** — this job would have been reported as costing nothing. Fixed; every call is now
> recorded (`CLAUDE.md` §3.4). **A call nobody can see in the ledger is a call nobody can add up.**

---

## C5 — THE CROSS-SECTION GATE

| # | section | checked | before | after | pass |
|---|---|---|---|---|---|
| 1 | all | `npm run check`, floor only up | 1108 | **1128** | ✓ |
| 2 | **Workspace** | `topics`, `turns`, `checklists`, `checklist_items` (caller / service) | — | 0/86, 0/221, 0/7, 0/38 | ✓ tenancy — Cascade has none |
| 2 | **HR** | `handbooks`, `handbook_sections`, `handbook_checks`, `handbook_check_sections` | — | 1/14, 0/83, 0/31, 0/226 | ✓ unchanged |
| 2 | Calendar | `calendar_events` | 5/6 | **2/3** | ✓ B9 removed the 3 seeded rows |
| 2 | Documents, Audits, Company info | as B6 | — | identical | ✓ |
| 3 | Workspace + HR | the shared files, both sections' free checks | — | re-run | ✓ |
| 4 | all 8 pages | load and show their rows, by **measured title** | — | 8/8, `BLOCKED (0)` each | ✓ |
| 5 | Workspace + HR | the nightly `summarise` job by hand (it drives both) | — | 200, `job_runs` row written | ✓ |
| 6 | all | emails unchanged by this job | `emailFrom()` | `emailFrom()` | ✓ |
| 7 | all | `check:live` on 3999 | ok | **ok** | ✓ |
| 8 | all | which golden sets would move | — | **two, and why** | see below |

### Part 8 — the golden sets are not re-run, and TWO would move

- **`npm run golden:facts`** exercises `prompts/checklist`. **Untouched** — it would not move.
- **`npm run golden`** and **`npm run golden:docs`** name no prompt file. Unaffected.
- **The summary golden sets WOULD move**, and this is the one place in the gate where the answer is
  "yes, and we are not paying to see it": both `prompts/summary-report.ts` and
  `prompts/hr-summary.ts` gained a paragraph and a JSON field. Every stored summary output will
  differ by at least the new `dates` key. **That is the intended change**, not a regression — but
  the owner's Opus test is what says whether the dates themselves are any good, and
  `docs/TEST-AT-FINISH-LINE.md` now carries a line in each section's part for it.

### What the gate caught

**The gate's own script had the failure the gate exists to catch.** It listed a Workspace table
called `topic_messages` — a table this product has never had. PostgREST returns `count: null` with
**no error** for a table that does not exist, so it printed a confident **0** from B6 until now, and
the Workspace's real messages table (`turns`, **221 rows**) was never counted at all. Both fixed: a
null count is now `NO TABLE`, and the name is right.

---

## What is NOT proved

- **Quality.** Everything here ran on Haiku, which is the rule for building (§3.4a) and is not a
  judgement of whether the dates a conversation yields are the right ones. **That is the owner's
  Opus test.**
- **Haiku varied between runs** on one of four cases. A date that appears on one run and not the
  next is a prompt question, not a code one, and belongs to the Opus pass.
- **No date has been added from a real summary through the screen.** The button is wired to
  `addDate` and the route is the Calendar's own, both covered by tests; what has not happened is a
  person pressing it on a real report.
