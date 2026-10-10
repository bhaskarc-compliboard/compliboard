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
