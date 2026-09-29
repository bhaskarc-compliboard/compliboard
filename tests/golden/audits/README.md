# Golden audit fixtures — seven more documents for Cascade, written for the Audits section

Written by the chat on 29 September 2026. Same shape as `tests/golden/documents/`: Claude Code renders the DOCUMENT TEXT of each spec into the file described under "Render as", byte for byte in content, and turns each ANSWER KEY into a case file the documents runner can check. The specs are the truth.

Why they exist: Cascade's first five documents let an audit say only "nothing on file". These seven make every honest word appear at least once, and give the template intake two checklists to read.

| Case | Kind | What it adds to the audit |
|---|---|---|
| 07-scrubber-log-record | record | condition 3.1 answered "on file", with the record's own findings; weekly C-1 checks with a missing week; an excursion that needs a deviation report |
| 08-deq-annual-report-2025 | record / report | condition 4.1 "on file" for 2025 while 4.2 stays "nothing on file"; a carbon replacement date that makes the 2026 replacement overdue by the report's own words |
| 09-forklift-training-records | record | the OSHA expected item answered "on file"; one operator "stale"; consistency with the September log |
| 10-osha-300a-2025 | record / report | the contradiction: 65 employees for 2025 against the plan's 42 as of February 2021 |
| 11-fire-extinguisher-certificate | certificate | a "stale" document, expired August 2026, under a third agency |
| 12-auditor-checklist-deq-air | template (Word) | the template intake: an agency's field form, fifteen lines |
| 13-company-self-check | template (Word) | the second template: the company's own form, eight lines, walk-through items included |

Each spec ends with an AUDIT USE section: what an audit must say once that document is on file. The two audit answer keys, `cascade-deq.md` and `cascade-osha.md`, are built from those sections and from the first five specs; the specs are the truth and the keys must not add expectations the specs do not state.

Order of reading under Cascade, so labels and "documents the company already holds" accumulate the way they will for a customer: 01, 02, 05, 06a, 06b, then 07, 08, 09, 10, 11, then 12, 13. Cases 12 and 13 are filed, not judged, and the audit reads their lines directly as templates.

Numbering continues from the documents set so a case id means one thing everywhere. The folder is separate so it is clear which fixtures were written for which section.
