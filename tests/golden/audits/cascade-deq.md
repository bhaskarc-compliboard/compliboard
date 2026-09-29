# cascade-deq — Oregon DEQ, Cascade Specialty Chemicals

**Agency label, exactly as it exists on staging:** `Oregon DEQ`
**Company:** Cascade Specialty Chemicals, LLC · Portland, Oregon
**Run date the key is written for:** 2026-09-29 (every passed/expiring line is against that date)

## What the audit is given

**Extended for the seven new fixtures, 29 September 2026 (Run 1b).** The lines below were written
from the AUDIT USE sections of specs 07 to 11. The specs are the truth; nothing here is an
expectation a spec does not state.

Originally one document carried this label: **02-acdp-chemical.pdf**, read as a permit, status
`expiring`, 14 conditions, 4 deadlines, 0 open gaps, 2 expected-and-not-seen, with four other
documents on file as titles only.

**Run 1b, on Haiku, mis-scoped this audit.** `Oregon DEQ` was given to 02, 06a, 06b, 07, 08, 09 and
12 — pulling both forklift logs and the forklift training record, all OSHA documents, into a DEQ
audit. **Run 1c, on the real model (`claude-opus-5-5`), scoped it correctly**: `Oregon DEQ` went to
02, 07, 08, 12 and (with OSHA) 13, and every OSHA document went to OSHA. No label correction had to be
written. The DEQ audit is therefore about the air permit, the scrubber log, the annual report and the
two checklists, which is what the specs assume.

**The zero matters.** The permit's reading found nothing wrong with the permit, so every finding in a
correct audit comes from its CONDITIONS measured against what is on file — not from a gap somebody
else already wrote.

## MUST

1. **`renewal-passed`** — the renewal application due **2026-07-18**, **passed**, with nothing on
   file. Condition 1.3.
2. **`expiry-date`** — the permit **expiring 2026-11-15**, with how long that is from today.
3. **`scrubber-log`** — the **daily scrubber log** as nothing on file, citing condition **3.1**.
4. **`quarterly-inspection`** — the **quarterly scrubber inspection records** as nothing on file,
   citing **3.2**.
5. **`carbon-records`** — the **annual carbon replacement records** as nothing on file, citing **3.3**.
6. **`opacity-records`** — the **opacity monitoring records** as nothing on file, citing **3.4**.
7. **`annual-report`** — the **annual report by 15 February**, recurring, nothing on file for 2026.
8. **`semiannual-report`** — the **semi-annual report by 31 July**, recurring, nothing on file for 2026.
9. **`not-a-document-question`** — at least one item in `not_document_questions`, drawn from the
   permit's operating conditions (1.1 operate in compliance, 5.1 minimise during malfunction, 5.2
   notify within 24 hours, 6.2 pay the fee).

### Added by the new fixtures (Run 1b)

Each line names the spec's AUDIT USE section it comes from.

10. **`scrubber-log-on-file`** — condition **3.1** answered **on file**, the scrubber log
    (07-scrubber-log-record.pdf), **carrying the reading's own findings** rather than re-deriving
    them: the missing August week, and the September 9 S-2 reading of 6.4 above the 6.0 limit.
    *Spec 07 AUDIT USE.*
    **This supersedes must 3, which has moved to ACCEPTABLE.** `nothing on file` and `on file` are
    opposite answers to condition 3.1, and a key that holds both cannot pass whatever the model says.
    Must 3 is kept, reported and not counted, because it is the right answer for a company that has
    not uploaded its log — which is most of them.
11. **`annual-report-4-1-on-file`** — condition **4.1** answered **on file for reporting year 2025**,
    received **2026-02-12**, this document (08-deq-annual-report-2025.pdf), with the next due
    **2027-02-15**. *Spec 08 AUDIT USE.*
12. **`semiannual-4-2-nothing`** — condition **4.2**, the semi-annual report for January to June
    2026 due **2026-07-31**: **nothing on file**. The annual report does not cover it.
    *Spec 08 AUDIT USE.*
13. **`carbon-due-2026-03-14`** — condition **3.3**: the last replacement was **2025-03-14** by the
    annual report's own words, so the 12-month replacement fell due **2026-03-14** and no record of a
    2026 replacement is on file. The finding must name the date from the document and say nothing is
    on file for 2026. *Spec 08 AUDIT USE.*
14. **`sep9-deviation-nothing`** — **nothing on file** for the **September 9, 2026** excursion in the
    scrubber log: condition 5.2 asks for notification within 24 hours and a written report within 15
    days, and no such report is on file. *Spec 12 AUDIT USE line A5, which also blesses noting that
    the 2025 deviation WAS reported per the annual report.*
15. **`quarterly-stated-not-on-file`** — condition **3.2**: the annual report states four inspections
    were carried out in 2025 and recorded in the scrubber maintenance file, but that file is not on
    file here. The audit may say "the annual report states they were done; the records themselves are
    not on file." *Spec 08 AUDIT USE.* This is the honest form of must 4 once 08 is on file.

## MUST NOT

1. **`no-satisfied`** — no finding worded as satisfied, compliant, met, or in compliance, anywhere in
   any string.
2. **`no-invented-document`** — no `document_id` that is not one of the ids given in the block.
3. **`no-forklift-as-scrubber`** — the forklift log never offered as the scrubber log. It is about a
   different machine; reaching for it is the single most tempting wrong move in this case, because
   the word "log" matches.
   **The "different agency" half of this line was briefly false and is true again.** Run 1b's labels
   put both forklift logs inside this audit's own document list, so the reason had to fall back on the
   machine. The real model returns them to OSHA, so they are in the titles-only tail again and both
   halves hold. The machine was always the sounder of the two reasons, because it does not depend on
   a label a model chose.
4. **`no-expected-as-finding`** — nothing from `expected_not_seen` duplicated into `findings`.
5. **`no-ai-word`** — the word "AI" appears in no output string.

## ACCEPTABLE

- A **scrubber operating and maintenance plan** under `expected_not_seen`. The permit does not require
  one by name; a company like this usually holds one.
- `readings_as_of` naming the date the permit was read.
- Conditions 4.3 (five-year retention) and 1.4 (60-day notice of change) as either findings or
  not-document questions — both readings are defensible.
- **Run 1b:** the scrubber log's own missing weekly C-1 detector-tube check (week of September 14) as
  a finding under 3.3 or as part of the 3.1 answer; both are defensible and spec 07 states the
  finding without assigning it a condition.
- **Run 1b:** noting that the August 2025 deviation was reported on time, as evidence of the practice,
  provided it is not offered as covering the September 2026 one.

## Where this key and the fixture agree, and one thing to watch

Every condition reference above was read out of the document itself and is in
`document_conditions` — 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2 all present with those refs. The key
asks for nothing the reading did not find.

**The trap in the must-nots is the word "log".** Cascade holds two forklift logs. An audit that pattern
matches on "log" will report the scrubber log as on file, and that is the failure this case exists to
catch — it would tell somebody they have a record they do not have, before an inspection.
