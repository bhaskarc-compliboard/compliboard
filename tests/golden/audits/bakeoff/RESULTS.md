# The rev 1 audit baseline — `claude-opus-5-5`, one open call, nothing switched on

**This file is the reference every later switch and every cheaper model is measured against.** It is
one configuration, not a bake-off: the model the owner set for rev 1, run as rev 1 will run it, over
all five golden audit cases, three times each. When the sections split is tried, when
`AI_AUDIT_STRUCTURED` goes on, when somebody asks whether Haiku or Sonnet would do — the question is
"against this", one change at a time, and the comparison is these tables.

**Run date:** 2026-09-30 · **Runs:** 15 (5 cases × 3) · **Configuration:** `AI_MODEL_AUDIT =
claude-opus-5-5`, **whole mode** (one open call per agency; three per template, one section each),
`AI_AUDIT_STRUCTURED` **unset — the schema is OFF**, **search UNCAPPED** (`DEV_MAX_SEARCHES` empty on
the command line; `.env.local` was not edited). **Target: staging.**

**Total from the ledger: $5.3667**, $0.3578 a run.

The tables below are generated — no figure in them is typed:

```
node --env-file=.env.local scripts/bakeoff-audit-capture.mjs claude-opus-5-5 baseline
node scripts/bakeoff-audit-report.js --model claude-opus-5-5 --label baseline
```

The capture step reads the ledger and opens each run's drawer once. **The report step calls no model
and reads no database**: every number traces to a stored run in `tests/golden/audits/runs/<case>/` or
to the ledger and drawer text in `<case>/baseline/`, which is the rule `DECISIONS.md` §139 set for
the documents bake-off. Per-case detail, with the text of every failed check, is in
`<case>/read-me.txt`.

## The comparison column

**`claude-haiku-4-5` is not a re-run.** It is the last stored batch of three whole-mode runs of the
same case, from the same fixture state — what Haiku last said, beside what the baseline says now. It
is there because every build session up to this one was measured on it (`CLAUDE.md` §3.4a), so it is
the only thing the baseline can be read against today. Two of its columns are blank on the template
cases and say so: the runner had no `ai_calls` id to look up on a template run, so its cost was never
recorded. **`(not recorded)` is not `$0.0000`.**

## Two verdict columns, and the difference is a matcher

`not-a-document-question` failed every run on cascade-deq while the answers held 2, 3 and 3 findings
worded `not_a_document_question`. The harness's `collections()` view compared the word — underscores
intact — against the same words **spaced**, so it could never match anything. It is fixed in
`scripts/run-golden-audit.js`; the fifteen stored verdicts are left exactly as they were written, and
the tables carry both columns. A re-judged verdict that overwrites the original leaves nobody able to
say which of the two a report was built on — §139's second report exists for that reason.

## Per case

| Case | Musts (run 1 / 2 / 3) | Musts in all three, as judged | Musts in all three, matcher corrected | Must-nots (all three) | claude-haiku-4-5: musts in all three, corrected |
|---|---|---|---|---|---|
| `cascade-deq` | 14 / 13 / 13 of 15 | 12 of 15 | **13 of 15** ⚠ | 6 of 6 | 10 of 15 |
| `cascade-fire` | 2 / 2 / 2 of 3 | 2 of 3 | **2 of 3** | 4 of 4 | 3 of 3 |
| `cascade-osha` | 7 / 7 / 5 of 7 | 5 of 7 | **5 of 7** | 3 of 4 | 5 of 7 |
| `cascade-template-12` | 12 / 14 / 13 of 17 | 12 of 17 | **12 of 17** | 2 of 3 | 10 of 17 |
| `cascade-template-13` | 9 / 9 / 9 of 9 | 9 of 9 | **9 of 9** | 3 of 3 | 4 of 9 |

| Case | Findings (1/2/3) | Finding-title overlap | Findings with NO word (1/2/3) | Expected-not-seen (1/2/3) | Its overlap | Reshaped to dates | Handle errors | Forbidden words |
|---|---|---|---|---|---|---|---|---|
| `cascade-deq` | 22/25/21 | **3/56 = 0.05** | 3/4/1 | 7/5/6 | 1/12 = 0.08 | 0 | 0 | **none** |
| `cascade-fire` | 4/5/4 | **0/12 = 0.00** | 0/0/0 | 6/5/3 | 2/7 = 0.29 | 0 | 0 | **none** |
| `cascade-osha` | 35/34/35 | **7/79 = 0.09** | 5/5/5 | 11/10/11 | 7/16 = 0.44 | 0 | 0 | **none** |
| `cascade-template-12` | 16/16/16 | **16/16 = 1.00** | 0/0/0 | 0/0/0 | — | 0 | 0 | no-satisfied |
| `cascade-template-13` | 8/8/8 | **8/8 = 1.00** | 0/0/0 | 0/0/0 | — | 0 | 0 | **none** |

| Case | Cost per audit (1/2/3) | Mean | Wall (mean) | claude-haiku-4-5 cost (1/2/3) | Its mean | Its wall |
|---|---|---|---|---|---|---|
| `cascade-deq` | $0.4508 / $0.4445 / $0.2158 | **$0.3704** | 129.5s | $0.0351 / $0.0277 / $0.0278 | $0.0302 | 37.0s |
| `cascade-fire` | $0.1082 / $0.1045 / $0.1091 | **$0.1072** | 40.4s | $0.0139 / $0.0125 / $0.0138 | $0.0134 | 13.4s |
| `cascade-osha` | $0.5171 / $0.5715 / $0.5462 | **$0.5449** | 192.3s | $0.0498 / $0.0487 / $0.0537 | $0.0508 | 66.3s |
| `cascade-template-12` | $0.5634 / $0.5580 / $0.5704 | **$0.5640** | 98.2s | (not recorded) / (not recorded) / (not recorded) | (not recorded) | 30.1s |
| `cascade-template-13` | $0.1997 / $0.2018 / $0.2058 | **$0.2024** | 43.8s | (not recorded) / (not recorded) / (not recorded) | (not recorded) | 17.5s |

**Total on the 15 baseline runs, from the ledger: $5.3667.**

## Per check, across the three runs

**Anything that is not 3/3 is not settled**, and 0/3 and 2/3 are different problems: 0/3 is the model
and the key disagreeing, 2/3 is the model disagreeing with itself.

### `cascade-deq` — per check, across the three runs

| Check | Kind | Baseline | claude-haiku-4-5 | The line |
|---|---|---|---|---|
| `renewal-passed` | must | **3/3** | 3/3 | renewal application due 2026-07-18, passed, nothing on file |
| `expiry-date` | must | **3/3** | 3/3 | the permit expiring 2026-11-15 |
| `quarterly-inspection` | must | **3/3** | 2/3 | quarterly scrubber inspection records, nothing on file, 3.2 |
| `carbon-records` | must | **3/3** | 3/3 | annual carbon replacement records, nothing on file, 3.3 |
| `opacity-records` | must | **0/3** | 0/3 | opacity records, nothing on file, 3.4 |
| `annual-report` | must | **3/3** | 3/3 | annual report by 15 February, recurring, nothing on file for 2026 |
| `semiannual-report` | must | **3/3** | 3/3 | semi-annual report by 31 July, recurring, nothing on file for 2026 |
| `not-a-document-question` | must | **3/3** | 0/3 | at least one not-a-document question |
| `scrubber-log-on-file` | must | 1/3 | 0/3 | condition 3.1 answered on file, the scrubber log, carrying the reading's own findings (spec 07 AUDIT USE) |
| `scrubber-log-findings-carried` | must | **3/3** | 3/3 | the scrubber log's own findings carried: the missing August week and the September 9 reading of 6.4 above 6.0 (spec 07 AUDIT USE) |
| `annual-report-4-1-on-file` | must | **3/3** | 2/3 | condition 4.1 on file for reporting year 2025, received 2026-02-12, next due 2027-02-15 (spec 08 AUDIT USE) |
| `semiannual-4-2-nothing` | must | **3/3** | 3/3 | condition 4.2, the semi-annual report for January to June 2026 due 2026-07-31: nothing on file (spec 08 AUDIT USE) |
| `carbon-due-2026-03-14` | must | **3/3** | 3/3 | condition 3.3: last replacement 2025-03-14 by the report's own words, so the 12-month replacement fell due 2026-03-14 and nothing for 2026 is on file  |
| `sep9-deviation-nothing` | must | **3/3** | 3/3 | nothing on file for the September 9, 2026 excursion: 5.2 asks for notice within 24 hours and a written report within 15 days (spec 12 AUDIT USE line A |
| `annual-2026-as-a-date` | must | **3/3** | 3/3 | the 2026 annual report as a DATE due 15 February 2027, not a finding. Condition 4.1 is recurring and the next one is five months out; nobody has faile |
| `no-satisfied` | must-not | **3/3** | 3/3 | no finding worded satisfied, compliant or met |
| `no-invented-document` | must-not | **3/3** | 3/3 | no document_id that was not given |
| `no-forklift-as-scrubber` | must-not | **3/3** | 3/3 | the forklift log never offered as the scrubber log |
| `no-expected-as-finding` | must-not | **3/3** | 3/3 | nothing from expected_not_seen duplicated into findings |
| `no-ai-word` | must-not | **3/3** | 3/3 | the word AI appears nowhere |
| `no-not-yet-due-as-nothing-on-file` | must-not | **3/3** | 3/3 | a submission not yet due presented as nothing on file. Read off the rows: any finding with word nothing_on_file whose due_on is after the run date. |
| `scrubber-plan-expected` | ok | **3/3** | 3/3 | a scrubber operating and maintenance plan under expected |

### `cascade-fire` — per check, across the three runs

| Check | Kind | Baseline | claude-haiku-4-5 | The line |
|---|---|---|---|---|
| `extinguisher-stale` | must | **3/3** | 3/3 | the annual maintenance as stale: certified 2025-08-20, next due 2026-08-20, passed, nothing on file since (spec 11 AUDIT USE line 1) |
| `six-year-nothing` | must | **0/3** | 3/3 | six-year maintenance for W-3 and L-1, due November 2026: nothing on file (spec 11 AUDIT USE line 2) |
| `monthly-not-a-document-question` | must | **3/3** | 3/3 | monthly visual inspections as a not-a-document question, or as nothing on file; the certificate says they are recorded on the unit tags (spec 11 AUDIT |
| `no-satisfied` | must-not | **3/3** | 3/3 | no finding worded satisfied, compliant or met |
| `no-invented-document` | must-not | **3/3** | 3/3 | no handle the block did not carry, and no id that was not given |
| `no-deq-permit` | must-not | **3/3** | 3/3 | nothing about the air permit; it belongs to another agency and is a title only here |
| `no-ai-word` | must-not | **3/3** | 3/3 | the word AI appears nowhere |
| `hydrostatic-dates` | ok | **3/3** | 3/3 | the hydrostatic test dates for the CO2 and water units as dates |
| `on-file-too` | ok | **0/3** | 0/3 | the certificate named on_file as well as stale; both are true of it |

### `cascade-osha` — per check, across the three runs

| Check | Kind | Baseline | claude-haiku-4-5 | The line |
|---|---|---|---|---|
| `carry-eap-gaps` | must | **3/3** | 3/3 | at least three of the plan's own open gaps carried as findings, in the reading's own terms. The gaps are READ from document_gaps for the current scan, |
| `plan-stale` | must | **3/3** | 3/3 | the plan as stale, as of February 2021 |
| `forklift-on-file` | must | 2/3 | 0/3 | the forklift logs as on file |
| `alarm-expected` | must | 2/3 | 0/3 | alarm testing or maintenance records as a finding against the plan's Section 2 condition |
| `training-records-on-file` | must | **3/3** | 3/3 | the powered industrial truck training records on file, with R. Patel stale: next evaluation due 2026-05-19 and nothing after 2023-05-19 recorded (spec |
| `employee-count-contradiction` | must | **3/3** | 3/3 | the 42 against 65 contradiction, naming both documents: 42 as of 2021-02-01 from the plan (confirmed) against 65 for 2025 from the 300A (only proposed |
| `extinguisher-stale` | must | **3/3** | 3/3 | the fire extinguisher certificate as stale, the annual maintenance expired 2026-08-20, passed at the run date (spec 11 AUDIT USE; spec 13 line 5) |
| `no-new-eap-gap` | must-not | 1/3 | 3/3 | no finding claiming a fault in the plan that the reading did not find. The allowed words are the plan's own open gaps and its own conditions, read liv |
| `no-deq-permit` | must-not | **3/3** | 1/3 | nothing about the air permit |
| `no-satisfied` | must-not | **3/3** | 3/3 | no satisfied, compliant or met |
| `no-ai-word` | must-not | **3/3** | 3/3 | the word AI appears nowhere |
| `sds-not-judged` | ok | **0/3** | 1/3 | the supplier SDS named as not judged |
| `forklift-gaps` | ok | **3/3** | 3/3 | the forklift log's own gaps carried — read from document_gaps for the current scan, not from the word "horn", which was one model's phrasing of one of |

### `cascade-template-12` — per check, across the three runs

| Check | Kind | Baseline | claude-haiku-4-5 | The line |
|---|---|---|---|---|
| `every-line-answered` | must | **3/3** | 3/3 | every line of the checklist gets a row, and no line is left without a word |
| `no-satisfied` | must-not | 2/3 | 3/3 | no line worded satisfied, compliant or met |
| `no-ai-word` | must-not | **3/3** | 3/3 | the word AI appears nowhere |
| `no-score` | must-not | **3/3** | 3/3 | no score: the header counts by word and shows no mark. Read off the rows — nothing carries a number out of a total. |

### `cascade-template-13` — per check, across the three runs

| Check | Kind | Baseline | claude-haiku-4-5 | The line |
|---|---|---|---|---|
| `every-line-answered` | must | **3/3** | 2/3 | every line of the checklist gets a row, and no line is left without a word |
| `no-satisfied` | must-not | **3/3** | 3/3 | no line worded satisfied, compliant or met |
| `no-ai-word` | must-not | **3/3** | 3/3 | the word AI appears nowhere |
| `no-score` | must-not | **3/3** | 3/3 | no score: the header counts by word and shows no mark |

### `cascade-template-12` — per checklist line

| Line | run 1 | run 2 | run 3 | claude-haiku-4-5 (last run) | The key accepts |
|---|---|---|---|---|---|
| A1 | `on_file` | `on_file` | `on_file` | `on_file` | on_file or stale |
| A2 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `stale` | nothing_on_file |
| A3 | `on_file` | `on_file` | `on_file` | `on_file` | on_file |
| A4 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | nothing_on_file |
| A5 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | nothing_on_file |
| B1 | `on_file` | `on_file` | `on_file` | `stale` | on_file or stale |
| B2 | **`on_file`** | **`on_file`** | **`on_file`** | `nothing_on_file` | nothing_on_file |
| B3 | `stale` | `stale` | `stale` | `nothing_on_file` | nothing_on_file or stale |
| B4 | `on_file` | `on_file` | `on_file` | `stale` | on_file or stale |
| B5 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | nothing_on_file |
| B6 | **`nothing_on_file`** | **`nothing_on_file`** | `on_file` | `on_file` | not_a_document_question or on_file |
| C1 | **`on_file`** | `not_a_document_question` | **`on_file`** | `nothing_on_file` | not_a_document_question |
| C2 | **`on_file`** | `not_a_document_question` | **`on_file`** | `nothing_on_file` | not_a_document_question |
| C3 | **`on_file`** | **`on_file`** | **`on_file`** | `nothing_on_file` | not_a_document_question |
| C4 | `stale` | `stale` | `stale` | `on_file` | stale or not_a_document_question |
| C5 | `stale` | `stale` | `stale` | `on_file` | on_file or stale |

### `cascade-template-13` — per checklist line

| Line | run 1 | run 2 | run 3 | claude-haiku-4-5 (last run) | The key accepts |
|---|---|---|---|---|---|
| 1 | `on_file` | `on_file` | `on_file` | `not_a_document_question` | on_file or stale or not_a_document_question |
| 2 | `on_file` | `on_file` | `on_file` | `nothing_on_file` | on_file or stale |
| 3 | `on_file` | `on_file` | `on_file` | `nothing_on_file` | on_file or stale |
| 4 | `on_file` | `on_file` | `on_file` | `nothing_on_file` | on_file or stale |
| 5 | `stale` | `stale` | `stale` | `stale` | stale or not_a_document_question or nothing_on_file |
| 6 | `not_a_document_question` | `not_a_document_question` | `not_a_document_question` | `not_a_document_question` | not_a_document_question |
| 7 | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | `nothing_on_file` | not_a_document_question or nothing_on_file |
| 8 | `on_file` | `on_file` | `on_file` | `nothing_on_file` | on_file or nothing_on_file |


## What the numbers show

Forty-one of the fifty-one must-lines held in all three runs, against thirty-two for Haiku, and no
case got worse; `cascade-template-13` went from 4 of 9 to 9 of 9 and every one of its eight
checklist lines carried the same word in all three runs. The four words were the only words used:
one must-not violation in fifteen runs, and it matched ` met ` inside *"It does not say the report is
complete or that the permit conditions were met"* — the model declining the claim the check forbids.
Zero handle errors, zero not-yet-due findings reshaped into dates, zero unparseable calls. The two
template cases answered every line, and their finding titles were identical across all three runs
(overlap 1.00); the three agency cases answered the same subjects in freshly worded titles every
time, and the title overlap is 0.00 to 0.09 — the same audit, never twice in the same words, which
is a matcher problem for anything that has to recognise a finding again. Twenty-three finding rows
across the fifteen runs carry **no word at all** — a title, a document and nothing else, rendered at
the top of FINDINGS — and Haiku's stored batches carry them too, so they are the shaping and not the
model (`lib/auditRun.ts:450`). It costs $0.3578 a run against Haiku's $0.0315 on the three agency
cases, 10.8× for 3.1× the wall clock, and five of the fifteen runs were truncated at 8000 output
tokens and retried at 16000, which is paid for twice inside every figure here: cascade-deq cost
$0.4508 and $0.2158 for the same audit, and that retry is the whole difference.

## What this file cannot say

It cannot say `claude-opus-5-5` is the right model, because nothing else was run: one configuration
measures itself. It cannot say a must-line that failed 0/3 is the model's fault — `opacity-records`
wants opacity records "nothing on file" and the baseline answered opacity
`not_a_document_question` in all three runs, which is arguably the better answer and is the kind of
disagreement §139 recorded rather than fixed. And it says nothing about a real company: five cases,
one fixture, twelve documents.

**Reversal condition:** the model is one Vercel variable and is meant to be moved. Re-run this file's
two commands against any new configuration and compare; the runs on disk are what make that
comparison possible six weeks later.
