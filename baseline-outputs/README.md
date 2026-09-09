# Baseline outputs — production, 2026-09-09

## What this folder is

A frozen copy of what CompliBoard's AI actually produced for real customers, exported
from **production** on **2026-09-09**. Thirteen tables, every column, every row, one
JSON file each.

It is a reference point, not a backup and not something the application reads. Nothing
in the codebase imports it. It exists so that a question which is otherwise unanswerable
— *"did that change make the output better or worse?"* — can be answered by comparing
against something concrete instead of by memory or impression.

## Why it exists

These rows were generated **before the determination gate and the critic pass were added
to the pipeline.** That matters, and it is the whole point of keeping them.

In plain terms: at the time these were produced, the AI was asked a question and its
answer was written down more or less as it came back. The two steps added since are
a *determination gate*, which stops the system asserting that a requirement definitely
applies when it has not actually established that, and a *critic pass*, which has a
second model read the first model's draft and challenge it before anything is saved.
Both were added because unanchored answers were confidently wrong in ways that were
expensive — one asserted a requirement that does not exist and attached cost estimates
to it.

So this folder is the "before" picture. When the same kinds of questions are run through
the current pipeline, the new output can be read side by side with these files to see
whether the guardrails actually improved the answers, left them unchanged, or made them
worse in some way nobody predicted. Without a saved "before", that comparison degrades
into arguing from memory.

Two things to keep in mind when reading these files:

- **Not all of it is AI output.** `companies`, `documents` and `calendar_events` are
  largely things people typed or uploaded. The AI-generated material is concentrated in
  `checklists`, `checklist_items`, `document_reviews`, `hr_audits`, `folder_audits`,
  `audits`, `requirement_templates` and `standard_templates`.
- **It is a snapshot, not a running log.** These are the rows as they stood on the
  capture date, including any a user had already edited or corrected by hand. It is not
  a record of what the model said the moment it said it.

## Where it came from

Exported read-only from the **production** Supabase project. No row was modified,
deleted, or written back, and the export was performed by a role with no write access.
The project reference is deliberately not recorded here.

`profiles` and everything in the `auth` schema were **deliberately excluded** — they hold
personal data about real people and contribute nothing to an output-quality comparison.
Some exported tables still carry a `user_id` or `company_id`, which are internal
identifiers, not names or contact details.

## Contents

| File | Rows | What it holds |
|---|---:|---|
| `audits.json` | 6 | Saved audit runs against a standard or an uploaded template |
| `calendar_events.json` | 47 | Compliance due dates and recurring events |
| `checklist_items.json` | 235 | Individual line items belonging to the checklists below |
| `checklists.json` | 11 | Generated checklists and saved research answers |
| `companies.json` | 10 | Customer company profiles, including website scan results |
| `company_templates.json` | 0 | A company's own uploaded audit template — empty in production |
| `document_reviews.json` | 33 | AI review of one document: dates, coverage, gaps, action items |
| `documents.json` | 38 | Uploaded file records (metadata only — no file contents) |
| `folder_audits.json` | 1 | Result of auditing a whole folder against an industry |
| `hr_audits.json` | 1 | HR handbook audit: what is present, what is missing, draft policies |
| `obligations.json` | 376 | Which requirements apply to which company, and their status |
| `requirement_templates.json` | 188 | The master requirements library by industry and jurisdiction |
| `standard_templates.json` | 1 | Reusable parsed checklist for a named standard |

**Total: 947 rows across 13 files.**

Row counts were verified against production at export time — each file's array length
was compared to a `count(*)` on the source table, and all thirteen matched.

## Format

Each file is a JSON array of objects, one object per row, indented for readability.
Column names and values are exactly as stored: `null` stays `null`, JSON columns such as
`line_items`, `gaps`, `action_items` and `scan_result` are nested objects rather than
escaped strings, and timestamps are ISO-8601 text.

`company_templates.json` contains an empty array — the table has no rows in production.
That is a real result, not a failed export, and it is kept so the set stays complete.
