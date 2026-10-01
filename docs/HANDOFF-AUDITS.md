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

## 5a. The page and the drawer, element by element

*Added 1 October 2026 (Run 8b, item 6). **For HR, and for anybody rebuilding a section in this
shape.** Every element in order of appearance, with the table and columns behind it, when it changes,
what it says when there is nothing, and the sentence it uses **verbatim**. Where a sentence is quoted
it is copied out of the file, not from memory.*

### Tab one — "Where you stand"

**The title and the line under it.** `Audits`, then:

> Where you stand with each agency, from the documents you have given us. Every line points at a
> document, or at something we do not see.

Static. It is the promise the whole page is measured against, and the second sentence is the one that
keeps "compliant" off the screen.

**The tabs.** `Where you stand` · `Past audits (n)`. The count is `audit_runs` for the company, every
status; it is in the tab rather than the body so a person can see there is history without opening it.
No count when there are none.

**The box.** A textarea and an `Audit` button. Three grey example lines, shown when it is empty:

> e.g. Audit us for Oregon DEQ
> e.g. Audit everything
> e.g. Audit us against the attached checklist

**How a sentence is matched** (`submitAsk`, and the order matters):

1. `/\b(checklist|template|attached|attach)\b/` → it cannot be answered without a file, so it opens
   the file picker and says *"Choose the checklist and we will audit against every line of it."*
2. `/\b(everything|all|every agency|all agencies)\b/` → a run with `agency: 'all'`.
3. Otherwise a **case-insensitive substring against the company's own agency labels, longest label
   first**, so `Oregon OSHA` wins over a shorter label contained in it. The rest of the sentence is
   kept verbatim as the run's `scope`: *"for the Portland plant only"* is the person's own words about
   what they meant, and the report shows it back to them.
4. No match → the agency names as one-click choices. The page knows exactly which agencies it can
   audit, so it says them rather than guessing.

Reads `company_labels` (kind `agency`) through `/api/audits/index`. With no labels at all it refuses
before matching: *"None of your documents carries an agency yet."*

**The attach control and the workspace link**, one line, one separator:

> Attach a checklist, your own or your auditor's · Or ask a question in the Compliance Workspace

The first is a `<button>` over a hidden file input — a checklist is a document, so it goes through
Documents' own upload path and then `POST /api/audit-runs` with `kind: 'template'`. The second is a
link to `/compliance`, because a question is not an audit and the page should not pretend to answer
one.

**The counts line.** One line, from `document_index_v` and `company_labels`:

> 12 documents read · 4 agencies · last audited 1 October 2026

The date is the newest `audit_runs.finished_at`; the clause is dropped entirely when there is none.
**This line is where the banners went** — every finished run used to raise one above a list whose
every row already carried its own date.

**The group-by.** `Group by: Agency` / `Subject` / `Site`. Agency is the only grouping that can be
audited, so under Subject or Site the page says so:

> Audits are run by agency. Grouping by subject arranges what you hold; the action stays on the
> agency it would be run for.

**An agency line, folded.** One row per `company_labels` agency, from `/api/audits/index`:

```
▸  Oregon DEQ          5 documents · last audited 1 October 2026 · 4 to look at      Audit again
```

`▸` is the only affordance; the whole row is the control (`role="button"`, Enter and Space). The
counts come from the newest done run's `summary`. Never audited: `5 documents · not audited yet`, and
the button reads `Audit`. While a run is going: `Audit running · <estimate>`, or
`waiting, section 2 of 4` for a queued section, and the button becomes `section 2 of 4`. A section
that failed adds an amber line: *"1 part of the last audit did not finish."*

**An agency line, open** (`AgencyBody`), in this order:

- **Subject rows.** One heading per distinct `document_scans.subjects` value, with a count, and
  `No subject yet` for the documents carrying none.
- **Document lines.** `document_index_v` — title, truncated, left-aligned, clickable (it opens that
  document's own report in the same drawer); the status on the right in Documents' own vocabulary
  (`Needs work`, `Expiring`, `Expired`, `Could not read`, `Not read yet`, `Current`, `Recorded`,
  `On file`), amber for the first four. A **record** also shows `· last entry <date>`, because a
  record's last entry is the only thing that says whether it is being kept.
- **Date lines**, from `document_deadlines`, **once per document** and not once per subject — the
  self-check carries five subjects and printed its two deadlines five times until that was fixed.
  Three forms: `<title> — 15 February 2027 · in 137 days`; `<title> — 14 March 2026 · passed` with
  passed in amber; and `<title> — recurs · no date in the reading` when `due_on` is null.
- **The last-audit sentence**, with every number a link into the report filtered to that word:

  > The last audit, on 1 October 2026, found 3 things with nothing on file, 5 things on file, and 1
  > thing out of date.

  A word with a count of zero is left out of the sentence. Nothing open at all: *"The last audit, on
  <date>, found nothing open."* No run yet: the sentence is absent.
- **The expected sentence**, from the run's `expected` findings:

  > Based on similar companies, we would also expect: <three titles>, and 29 more.

  Three, then a count — a sentence with six names in it is a list again. The full list is in the
  report.

**The checklist status line.** A template run has no agency row to live on, so it gets one grey line
under the box — the only thing on this page that is not a row:

> Your audit against Monthly EHS Self-Check (blank internal checklist template), Portland Facility
> is running · about 2 minutes

and when it lands, `is done · 8 to look at · Open`. Opening it takes the line away.

**The closing sentence.**

> An audit of everything runs one section per agency, in this order. Each line updates as its
> section lands. We will email you when the last one is done.

**The empty states**, in the order they are checked. No documents at all: *"Read some documents
first. Audits are built from their readings."* with a `Go to Documents` action. Documents but no
agency label: *"None of your documents carries an agency yet."*

### Tab two — "Past audits"

One row per `audit_runs`, newest first. Empty: *"No audits yet."* Two forms:

```
1 October 2026   All agencies
                 12 to look at · 4 of 4 sections · 5 of 17 from 30 September 2026 closed   Open

1 October 2026   Against Monthly EHS Self-Check (blank internal checklist template)
                 8 to look at · 1 of 1 section                                             Open
```

A **template** run is named by its checklist: its `agency_label` is null because its questions came
from a form, and the fallback read `All agencies`, which is the one thing it is not. Still running:
`Running · <estimate>`. A failed section adds `<section title> did not finish.` in amber. The
person's own words, when they typed any, are quoted underneath.

### The drawer — the report

**The header.** `Oregon DEQ audit`, or `Audit of everything · 4 sections` when `section_count > 1`.
Not the agency list: four agencies is a wall of text in a title, and they are each a group heading
below anyway.

**The meta line**, one line, built once:

> audited 1 October 2026 · 4 sections · 12 documents read, 12 held unread · readings as of 1 October 2026

`readings as of` is the newest `document_scans.scanned_at` of what was read — the audit's date says
when we looked, that says how old what we looked at was. **"held unread" is what NO section read**
(Run 8a, item 1b): the plain union of each section's unread list is the same twelve documents on a
whole-company run.

**The "You asked" line.** `run.scope`, quoted, when the person typed something. Absent otherwise.

**The sentence that says what the report is**, outside every fold:

> Every line below points at a document, or says what we do not see. None of it is a verdict on
> whether the company complies.

**The filter pills.** `all` and one per word with a count above zero: `all · 25 nothing on file · 9
out of date · 5 on file · 2 not a document question`. Clicking one narrows every group below;
`all` clears it. `no-print`, with the same counts printed as a plain line instead. A checklist report
adds `n we did not get an answer for`.

**A section group.** One `audit_sections` row, folded, titled with the agency and carrying its own
count; its counts by word on the first line inside. All closed, **except a single-section run, which
opens its one group** — folding the only content is a click that hides everything. A section that
could not complete shows its reason and a `Run this section again` action.

**A document group.** The document each finding cites, **once**, left-aligned, one line, truncated,
with its status on the right. Findings with no document go in one group at the end titled *"Not tied
to one document"*.

**A finding line, closed.** The word, then the title, truncated to one line. `▸`, and the whole line
is the control. A collapsed duplicate adds `also under <agency>` in grey; a handle the block did not
carry adds `no document matched` in amber.

**A finding line, open.** The locator, the quote in italics, what to do, then `Add a document` (only
for `nothing_on_file`) and `Not right`, which opens a reason box. **Rendered and hidden, never
unmounted** — so Print carries it.

**Dates** · `kind = 'date'`, passed first, then by date, then undated last; each with `Add to
calendar`, except an undated recurring one, which has no link because a calendar row with no date is
false precision. **Disagreements between documents** · `kind = 'contradiction'`, both documents and
both values, and it does not pick one. **What we would expect and do not see · based on similar
companies** · `kind = 'expected'`, a suggestion and it says so. **Could not complete** · sections
with that status, each with its reason and a retry. **Earlier audits** · previous done runs of the
same agency, or, for a checklist, earlier runs against that checklist with what moved per line.

**The actions**, in the footer: `Audit again` (a new run with `previous_run_id` set, so the next
report can say what closed), `Make a checklist`, `Print`, `Download the documents`, and a quiet
`Not right` for the run as a whole.

**What Print adds.** Every group and every finding, open, whatever was folded or filtered on screen —
the detail is `hidden print:block`, and the filter hides rather than removes. The drawer prints as
the page (`body.printing-drawer`), the pills are dropped and the counts print as a line.

**What the zip holds.** `GET /api/audit-runs/[id]/documents` — exactly the documents that audit read,
from `audit_sections.documents_read`, streamed. Not the whole filing cabinet: the zip is the evidence
behind this report.

### The email

**Subject:** the run's one-sentence summary. **Body:** plain text, in this order — the summary
sentence; `Read against your documents as they stood on <date>.`; `What needs you:` and up to the
first few attention items with their word and document, then `…and n more.`; `It also found 5 things
on file and 3 things we would expect a company like yours to hold and did not see — a suggestion, not
a checked requirement.`; the disagreements sentence; what carried or closed against the last audit;
the sections that could not be finished; and `See it all: <url>/audits?run=<id>`. Every finished run
is emailed; there is no batch-of-one silence. **No price, ever.**

### How HR takes this shape

**One agency group and one document.** An HR audit is this page with `company_labels` holding one
label — the employer's own obligations rather than a regulator's — and most findings citing one
handbook rather than twelve permits. Everything else is unchanged: the four words, the one-line
finding opening on click, the counts as filters, the folded group that opens because it is the only
one, the email, the zip. **What it must not do is add a fifth word or a score**, which is the thing a
staffing report is always tempted to do; and `hr_audits` is the retired engine's table, so the rows
are `audit_runs`, `audit_sections` and `audit_findings` with a `kind` of its own, not a second set of
tables with a second vocabulary.

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

### The gate failures this section knows about and accepts

*Added 1 October 2026 (Run 8a, item 2). **There was no gate table in this file before** — it recorded
what was owed and what had not been judged, and nowhere said which `check:live` checks fail on
purpose. A reader running the gate found red and had nothing to compare it against.*

**Every one of these is a Haiku-tier line.** `.env.local` points the chat and judgement tiers at
`claude-haiku-4-5` because a build session spends its calls on shape (`CLAUDE.md` §3.4a). Production
runs `claude-opus-5-5` for the audit tier. **A failure here is not a failure on production**, and the
column that says so is the last one.

| `check:live` check | What fails | Judged on the real model |
|---|---|---|
| `template findings` | Haiku, shown a four-line checklist and **two** documents — one of which is the checklist — replies in prose asking for the checklist lines it was already given. Four runs on 1 October, four refusals, three different wordings. | **Passes.** The rev 1 baseline answered **16 of 16** lines of the fifteen-line inspector's form and **8 of 8** of the self-check on `claude-opus-5-5`, three runs each, finding-title overlap 1.00. |
| `convert complete` | The §143 chat-tier pair's intermittent half: it returns one origin where the check wants both. Fails on some runs and passes on others an hour apart. | Not Audits. The chat tiers are not Haiku on production. |
| `checklist` | **Newly seen 1 October 2026** and intermittent in the same way: `POST /api/chat` with `mode: 'checklist'` came back with no `must_do` array, then on the next run returned 8 `must_do` and 4 `good_to_have` with the shape intact. Nothing Audits changed reaches that route — `grep -c` for `auditRun`, `audit-agency` and `companyLabels` in `app/api/chat/route.ts` all return 0. | Not Audits. |
| `attachment/tier`, `attachment/errors` | §143's reliable pair: Haiku names three of the staff policy's seven errors where the check wants five, and does not name the tier. | Not Audits. |

**`template findings` is the one worth reading twice, because four hypotheses died proving it is not
ours.** In order, each disproved at the line:

1. **The checklist lines were unanswerable from the seeded evidence.** They were — three of the four
   asked about records the one seeded document does not mention. Rewritten so each is answerable from
   it (the permit on file, its expiry, its agency, its site). **Still refused.**
2. **The lines never reached the prompt.** They did. The section's stored `prompt_sha256` equals
   `sha256(auditTemplatePrompt(storedSection))`, and the rendered prompt contains
   `1. An air quality permit for this facility is on file` … `4. The permit is tied to the site it
   covers`. The stored `audit_runs.template_lines` holds all four.
3. **The lines are in the system prompt and the model follows the user turn.** Measured both ways
   against Cascade: **both parse, four lines each.** Placement is not the variable.
4. **The fixture company's stale agency labels contradict the checklist.** `Test Gamma Solvents`, a
   Portland chemical manufacturer, really did carry three Washington/Seattle agencies. Pruned to
   zero and re-run. **Still refused.**

What is left is the measured fact: the same prompt and the same lines parse cleanly against
Cascade's **twelve** documents and are refused against **one**, with `buildAuditInput` putting that
one in the block as `D1` in a 1648-character block. **So it is a product behaviour on a
one-document company on a cheap model, not a fixture defect** — and the fixture was deliberately not
enriched to make the gate green, because a fixture tuned until the model complies measures the
fixture. If a cheaper model is ever measured against the baseline (§8 item 4's neighbour), this is
the first thing that will fail and the reason is already written down.

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
