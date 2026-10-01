# HANDOFF — THE AUDITS SECTION

*Rewritten 1 October 2026, the day Audits rev 1 was prepared for production. The previous version of
this file was the brief the Audits chat was handed on 26 September, before the section existed; it has
been replaced rather than appended to, because a brief and a state are different documents and keeping
both in one file is how a plan comes to be read as a description.*

**This file is the state of the section.** What Audits is and what it reads; the tables and the routes;
the sweep, the cron and the email; the page and the drawer as they finally are; the four words and the
design rules that are not open to reinterpretation; the golden cases and how to get a working fixture
back; what is owed after release, in order; what this section handed to other sections; and what has
not been judged.

What it is **not**: the method. `HOW-WE-BUILD.md` holds that, unchanged, and it worked —
`DECISIONS.md` §144 to §149 are this section's decisions in the order they were made.

---

## 1. What Audits is, and what it reads

An audit is a by-product of Documents. **It does not read files.** It reads readings, and says — per
agency, or per line of a checklist somebody hands us — where the company stands against what its own
documents say, and what is not there at all.

Everything it needs already exists after a document is read: what each document is, what is wrong with
it, what it obliges the company to keep doing, the dates it sets, the facts it proved, and what a
company like this usually holds. `buildAuditInput` in `lib/audit.ts` assembles exactly that into one
block:

- `document_index_v` for the company's documents — kind, title, agencies, status, significant date.
  The view is where `document_corrections` is applied, so a corrected label really does change what an
  audit sees.
- the four tables hanging off a scan: `document_gaps`, `document_conditions`, `document_deadlines`,
  `fact_proposals`.
- `company_facts` for what a person has confirmed, kept apart from what a reading merely proposed.
- every other document the company holds, **by title only**, so the audit can say what is *not* among
  them without being shown their contents.

**Two scopes.** An agency audit is scoped by the agency label on a document — compared exactly, which
is why a record filed under the wrong regulator is invisible to the right regulator's audit. A template
audit passes the `'*'` sentinel and is shown **every** document the company holds, because a checklist
spans regulators: case 13's own monthly form covers the air permit, the forklifts and the
extinguishers.

**The handles.** The model never sees a UUID. Documents arrive as `D1 … Dn` and `resolveHandles` /
`shapeFindings` map them back. A handle the block did not carry does not vanish: the row is written
with `handle_error = true`, which the golden runner counts. "D14" can be checked against a list of
twelve; one wrong character in a UUID could not.

---

## 2. The tables

Three, from **migration 058**, plus what 059 and 060 added.

| Table | What a row is |
|---|---|
| `audit_runs` | one audit a person asked for. `kind` is `agency` or `template`; `agency_label` or `template_document_id`, never both (`audit_runs_kind_has_its_subject`). Carries `summary` jsonb, `section_count`, `previous_run_id`, `status`, `started_at`/`finished_at`, `notified_at`, `dismissed_at`. |
| `audit_sections` | one agency, or one section of a checklist. The unit of work the sweep claims. Carries its own `model`, `prompt_sha256`, `input_sha256`, `ai_call_id`, `json_parsed`, `raw_text`, `documents_read`, `documents_held_unread`, `handles`, `claimed_at`, `could_not_complete_reason`. |
| `audit_findings` | one line of a report. `kind` is `finding`, `date`, `contradiction` or `expected`; a CHECK per kind enforces the shape. |

**The thing in 058 that matters most is not RLS.** Every finding carries `company_id` and is tied to
its run, its section, its document and its scan by **composite foreign keys on `(company_id, <id>)`**.
So a finding cannot cite another company's document — not because a policy forbids the read, but
because the row will not go in. RLS cannot catch that: a service-role writer passes every policy. The
migration's verify block tries the write and requires the refusal.

**059** added `audit_findings.template_line` / `template_text` and `audit_runs.template_lines`. The
line's own reference *and the line as printed*, because "A2" is not a question unless you have the form
in front of you — and the run stores the questions it was asked so a re-audit asks the same ones
without paying to extract them again.

**060** narrowed one CHECK by one case: a `date` may have a null `due_on` **when `recurs is true`**.
A non-recurring date with no day is still refused. The rev 1 baseline is why: eighteen date items came
back as real recurring obligations with no day in them ("Annual permit fee (Condition 6.2)"), the old
CHECK refused them, and `shapeFindings` demoted each one to a finding — which carries no word, so
twenty-three rows rendered as a title, a document and nothing else. `recurs is true` and not
`recurs is not false` is deliberate: null means the model did not say, and that is a reading which did
not finish.

Every one of the three tables is `REVOKE`d from `anon` and `authenticated` and then granted
`select, update` to `authenticated` only — **no INSERT**. A person reads and annotates an audit; only
the server writes one. 058's verify block reads the grants back with `has_table_privilege` rather than
trusting its own grant list.

---

## 3. The routes

| Route | What it does |
|---|---|
| `GET /api/audits/index` | the page's **one** read: every run, its sections, the agency lines, the documents-read count, the estimate. |
| `POST /api/audit-runs` | start one. `kind: agency` with an agency or `all`; `kind: template` with `template_document_id`. Returns the run, its section count and the estimate, and kicks the sweep with `after()`. |
| `GET /api/audit-runs/[id]` | one run, its sections and its findings in one request — everything the drawer renders. `PATCH` dismisses the banner, once. |
| `POST /api/audit-runs/[id]/sections/[sid]/retry` | run one section again. A section that failed is the only thing re-bought. |
| `GET /api/audit-runs/[id]/documents` | the documents that audit read, as a zip, streamed. |
| `POST /api/audit-checklist` | a checklist from an audit, or from chosen findings. |
| `PATCH /api/audit-findings` | a person's own edits: dismiss with a reason, correct, mark done. |
| `GET/POST /api/jobs/audit-sections` | the sweep. `CRON_SECRET` on the cron path. |

All of them derive `company_id` from the verified session through `requireCompany()`, never from the
body, and return **404 rather than 403** for another company's row so ids cannot be probed.

**The old engine is gone.** `app/api/audits/route.ts` and the old page were deleted in Run 3, in the
same commit that built the new ones. The `audits` and `hr_audits` tables are **kept and unread by this
section** — `scripts/schema-doc.js` labels them "the retired engine, tables kept". Nothing in
`app/dashboard` or `components/` reads them; that was swept and re-swept on 1 October and the grep
returns nothing.

---

## 4. The sweep, the cron and the email

**An audit is queued rows and a cron, not a request.** One agency is 30–70 seconds on Haiku and three
minutes on the real model; a four-agency company is most of a coffee break. The person has left.

- `createRun` writes the run and one `audit_sections` row per agency or per checklist section, all
  `queued`.
- `POST /api/audit-runs` kicks `sweep()` through `after()` so the first section starts at once; the
  cron in `vercel.json` — `/api/jobs/audit-sections`, `*/5 * * * *` — is what finishes the rest and
  what picks the work up if the kick is lost.
- The sweep claims **a whole company's** queued sections in one statement and writes `claimed_at`,
  **not** `status = 'running'`: the same reason the document sweep claims on `reading_since`. A second
  overlapping sweep sees nothing unclaimed for that company and moves on, which keeps one company's
  audits strictly one after another.
- Stuck sections — `running` with an old `claimed_at` — are returned to `queued` at the top of every
  cycle, guarded so a section that finished in between is not clobbered.
- `runSection` **never throws.** Every failure lands as `could_not_complete` with a sentence a person
  can read, stored on the row. One section's death costs one section.
- `finishRunIfDone` closes the run and `notifyRun` emails it. **Every finished run is emailed** —
  there is no batch-of-one silence, because an audit that finishes silently is an audit nobody reads.
  Plain text, the summary and the link, `notified_at` set only on a send that actually succeeded, the
  `NEXT_PUBLIC_APP_URL` refusal and the `NOTIFY_TEST_TO` override that says at the top where it really
  went.
- `estimateRun` is **measured, never guessed**, from this company's own finished sections and then
  from everyone's, and it says which it used. With nothing to go on it declines to estimate rather
  than inventing a number.

---

## 5. The page and the drawer, in their final shape

`app/audits/page.tsx` and `components/AuditReport.tsx`. Three owner reviews shaped them; what follows
is where they landed, and the reasons are the part worth keeping.

**The page.** A box you type into ("Audit us for Oregon DEQ", "Audit everything", "Audit us against the
attached checklist"), the attach line and the Workspace link under it on one line, then one thin line —
`12 documents read · 4 agencies · last audited 30 September 2026` — then one row per agency with its
own count and date and its own Audit button, and a Past audits tab.

**No banners.** Every finished run used to raise one, so two runs in a morning put two "audit of
everything is done" lines above a list whose every row already carried its own date. The date they
carried moved to the thin line. `dismissed_at` stays a column and **nothing reads it**: a dismissal
already recorded is not ours to erase.

**One exception, because it has nowhere else to live.** A checklist run has no agency row, so it gets
one grey line under the box while it runs and one when it lands, and opening it takes the line away.
Past audits names such a run by its checklist, not "All agencies", which is the one thing it is not.

**The drawer opens folded** when a report has more than one section — every section closed with its
count, a table of contents, so you can see the shape of the answer before reading it. An agency report
opens **Findings** and nothing else, because that is what it is for; a one-section report opens its one
section. The sentence saying what the report is stays outside the folds. Folded sections are hidden
with CSS and still render, so printing gives every page and `scripts/page-text.mjs` can read the whole
report.

**A date that recurs with no day** reads `<title> — recurs, no date in the reading`, and has no "Add to
calendar" link: a calendar row with no date is the same false precision one step on.

**A checklist naming another company** is noted and audited anyway — *"This checklist names X; treated
as a template for you."* An auditor's field form names somebody who is not you, and auditing yourself
against one is a normal thing to want. The model's instinct was to refuse; the product's job is to say
what it noticed and get on with it.

---

## 6. The four words, and the design rules

**Four words, and no fifth.**

```
on_file   stale   nothing_on_file   not_a_document_question
```

`lib/auditRun.ts`'s `WORDS`. `normaliseWord` maps two near misses it has actually seen — `expiring`
and `expired`, which are Documents' status vocabulary for the same claim — and records that it did so.
Anything else is **not** a fifth state: it is dropped, counted as `dropped_wordless` on the run, and
reported in the log. There is no score, no percentage and no grade anywhere in the section.

**And the rules that are not open to reinterpretation:**

- **"Compliant" is never a status.** Not in a prompt, not in a label, not in a summary. Every report
  carries the sentence: *every line points at a document, or says what we do not see; none of it is a
  verdict on whether the company complies.* The golden keys forbid `satisfied`, `compliant`,
  `in compliance`, `met` and `all clear` as claims about the company.
- **Never name what did the reading.** No "AI", no model name, on any customer surface. The golden
  keys sweep for the bare word.
- **Cost is never on a customer screen.** It stays in `ai_calls`, in `npm run cost`, in the golden
  tables and in `costOfSections` for those readers. Three routes served it once; §147 took it out.
- **A submission not yet due is a date, not a finding.** "Annual report for 2026 — nothing on file",
  against a report due five months out, is a page full of noise burying the renewal that really is
  late. Said in the prompt *and* enforced in `shapeFindings`, which reshapes it and counts the
  reshaping.
- **A line answered in part is `on_file`**, with what is missing in `what_to_do`. Calling a partial
  answer `nothing_on_file` tells somebody they have nothing when they have most of it, and they stop
  trusting the report.
- **A finding is never written without a word.** The backstop is in `shapeFindings`. The one deliberate
  exception is a checklist line the model skipped, which gets a row saying *"We did not get an answer
  for this line"* — wordless and saying so is a different thing from wordless and saying nothing.
- **Every model call writes a cost row**, task `audit`, and the model comes from the `audit` tier
  (`AI_MODEL_AUDIT`, else the judgement tier). 16,000 output tokens from the first attempt; the
  doubling retry in `lib/ai.ts` stays as the backstop.

---

## 7. The golden cases, the fixtures, the restore and the baseline

**Five cases**, `tests/golden/audits/cases/`: `cascade-deq`, `cascade-osha`, `cascade-fire`,
`cascade-template-12`, `cascade-template-13`. Run with `npm run golden:audit`. The judge reads the
**rows**, not the model's JSON, so handle resolution, the per-kind CHECKs and every demotion are inside
what the key measures.

**Seven fixtures, 07 to 13**, `tests/golden/audits/`, written so every honest word appears at least
once and the template intake has two real checklists:

| | |
|---|---|
| 07 scrubber log | condition 3.1 answered `on_file`, carrying the record's own findings |
| 08 DEQ annual report 2025 | 4.1 on file while 4.2 stays nothing-on-file; a carbon date that makes 2026 overdue by the report's own words. Its status is **reported-only**: a receipt is not a compliance determination, and the document says so |
| 09 forklift training | the OSHA expected item answered `on_file`, one operator `stale` |
| 10 OSHA 300A 2025 | the contradiction: 65 employees for 2025 against the plan's 42 as of February 2021 |
| 11 extinguisher certificate | a `stale` document under a third agency |
| 12 DEQ inspector's field form | the template intake, fifteen lines, an agency's own form |
| 13 company self-check | the second template, eight lines, walk-through items included |

Read in order — 01, 02, 05, 06a, 06b, then 07–11, then 12, 13 — so labels accumulate the way they do
for a customer.

**Getting a working fixture back after a reset.** `npm run db:reset` rebuilds the schema and nothing
else. Then `npm run db:restore`, which has ten steps; step 9 restores Cascade's twelve readings from
`tests/golden/documents/runs/real-model/` **through the same `saveScan` with `linkLedger: false`** and
makes **zero model calls**, and step 10 runs `run-golden-audit.js --fixtures-only`, which relinks
`testcascade@example.com` to the recreated company, confirms the one fact the OSHA contradiction needs
(the plan's 42), and writes agency-label corrections only where a reading contradicts that document's
own answer key. A reset costs nothing and takes minutes.

**The baseline is the reference.** `tests/golden/audits/bakeoff/RESULTS.md` — five cases, three runs
each, `claude-opus-5-5`, one open call, nothing switched on, **$5.37**. 41 of 51 must-lines held in all
three runs against Haiku's 32, no case worse, zero handle errors, zero unparseable calls. Cost per
audit from $0.11 for one document to $0.56 for a three-section checklist. **Every later switch and
every cheaper model is measured against it, one change at a time**, with the two commands named in its
own header; the drawer text of all fifteen runs is stored beside it.

---

## 8. What is owed to the section after release, in this order

This order is the owner's, and the reasoning for it is in each line.

1. **The sites screen.** `switch_scope` says 73 of the 95 switches are per-site, and an audit is scoped
   to a company. A second plant has its own permit, its own generator category and its own forklifts,
   and until a person can say which site a document belongs to, a two-site company gets one audit that
   is wrong for both. **Nothing in this section has been judged on a two-site company** (§10).
2. **The question path from the box.** The box accepts "Audit us for Oregon DEQ" and "Audit everything".
   A person who types a question — "do we need a stormwater permit?" — gets nothing. It belongs in the
   Workspace and the box should route it there rather than failing to parse.
3. **The inspector's findings letter as an intake.** The template intake reads a blank checklist. The
   document a customer actually has after an inspection is a letter listing what the inspector found,
   and it is the same shape of problem: lines in, one answer per line out, against the documents on
   file. It is the first intake a real customer will want and it needs no new table.
4. **Prompt caching, as a measured switch.** An agency audit sends 20–30k input tokens and most of it
   is the same block on every run of the same company. Input was 43% of this section's bill. It is a
   switch measured against the baseline, never built into it.
5. **The worker — on the day `job_runs` shows budget exhaustion, and not before.** The sweep runs in a
   serverless route under a cron and finishes four sections comfortably. A company with twelve agencies
   on the real model will not finish inside the limit. `job_runs` is where that will show; move it when
   it does.
6. **The binder — after the file-types run.** Printing one report works. A binder is every report, the
   documents behind them and a cover sheet, and it depends on reading file types the scan cannot open
   today. Doing it before that produces a binder with holes in it.

---

## 9. What this section handed to other sections

- **To Documents: three real-model reading behaviours.** On `claude-opus-5-5`, the same sentence that
  made Haiku propose a headcount proposes `employs_drivers`, `onsite_laboratory` and
  `employees_evacuate_during_fire` instead — so a fixture that fished a proposal out by `switch_key`
  became a silent no-op. The real model also returns Documents' own status words (`expiring`,
  `expired`) where an audit word belongs, and returns a whole line where a reference was asked for.
  All three are in `lib/auditRun.ts`'s normalisation and in `scripts/run-golden-audit.js`'s matching;
  Documents' golden set has not been re-judged against any of them.
- **Label drift and the merge.** An audit is scoped by an exact agency label, which made label drift a
  visible defect for the first time: `Oregon OSHA` and `OSHA` on two documents are two agencies to an
  audit. The merge and `document_corrections` through `document_index_v` are the mechanism; the
  **cause** is in the scan, and that is Documents' to fix.
- **To research: the facts switch.** Confirmed facts and proposed facts have to be shown to a model
  differently or it states a proposal as true — the 300A's 65 against the plan's confirmed 42. The same
  distinction applies to every prompt that is shown `company_facts`.
- **To HR audits: this shape.** `hr_audits` is still the old engine's table. When HR audits are
  rebuilt, the shape is the one here — runs, sections, findings, one word per line, a cron, an email —
  not readiness numbers computed from reviews.

---

## 10. What has not been judged

- **A two-site company.** Everything in this section has been measured on Cascade, which has one site
  called Portland. An audit is scoped to a company, documents carry a site, and nothing has tested what
  a report looks like when two sites hold different permits. This is item 1 of §8 for that reason.
- **A company with no documents at all.** `createRun` returns a finished run with a sentence instead of
  an empty report, and that path has unit coverage but no manual pass.
- **More than four agencies on the real model**, which is where the serverless limit is.
- **A checklist longer than fifteen lines**, and a checklist whose lines are in a picture rather than
  in text — the extraction says so plainly and audits nothing, which is the right behaviour and has
  not been seen by a person.
- **The six-word negation window** in the golden judge excuses "has never said the conditions were
  met" and does **not** excuse the baseline's own sentence, where the negation is eleven words back.
  A keyword check cannot be made to see that sentence; it is recorded, not solved.
