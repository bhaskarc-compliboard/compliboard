# cascade-osha — the OSHA audit, Cascade Specialty Chemicals

**Agency label, exactly as it exists on staging:** `Oregon OSHA`
*(Run 1b, on Haiku, produced `U.S. Department of Labor - Occupational Safety and Health
Administration` instead and left no `Oregon OSHA` row at all. The real-model pass on 29 September —
`claude-opus-5-5`, as production runs it — produced `Oregon OSHA` for all six OSHA documents. Both
strings are recorded and **not merged**: which name a company's vocabulary ends up carrying is the
reading model's choice, and the two models chose differently for the same regulator.)*
**Company:** Cascade Specialty Chemicals, LLC · Portland, Oregon
**Run date the key is written for:** 2026-09-29

## What the audit is given

**Extended for the seven new fixtures, 29 September 2026 (Run 1b).** The added lines come from the
AUDIT USE sections of specs 09, 10 and 11. The specs are the truth.

When this key was written, three documents carried the OSHA label:

| document | read as | status | open gaps |
|---|---|---|---|
| `01-eap-chemical.pdf` | policy — Emergency Action Plan | `gaps_found` | **4** |
| `06a-forklift-log.pdf` | record | `gaps_found` | **3** |
| `06b-forklift-log-photo.pdf` | record | `recorded` | 0 |

The permit and the supplier SDS are on file as titles only.

**Run 1b, on Haiku, showed none of those three to this audit.** The labels came back `Oregon DEQ` for
both forklift logs, `Oregon DEQ` for the forklift training record, and `agencies: []` for the
emergency plan, so the OSHA audit was shown three entirely different documents and musts 1 to 3
failed 0/3 for want of the documents they are about.

**Run 1c, on the real model, put every one of them back.** `claude-opus-5-5` gave `Oregon OSHA` to the
emergency plan, both forklift logs, the training record, the 300A and the extinguisher certificate —
six documents, each matching its own spec's answer key. **No label correction had to be written**; the
fixture-correction step (`correctFixtureLabels`) found nothing to correct.

That difference is the finding, and it is worth stating plainly: **the agency label is the audit's
scope, and on the cheap model it was wrong often enough to hide half the evidence.** An audit cannot
detect this — a document filed under the wrong regulator is simply absent, and absence is what the
audit is designed to report. The label is not a caption; it is the join.

### No fire authority label, so case 11 is scored here

A `cascade-fire.md` exists **only if** the readings of 11 carry a fire authority label. **Neither
model gave it one.** Haiku filed it under the federal DOL string; the real model filed it under
`Oregon OSHA`. `company_labels` for Cascade holds exactly two agency rows — `Oregon OSHA` and
`Oregon DEQ` — and no `Portland Fire & Rescue`, `Fire Marshal` or `OSFM`. So case 11's audit lines
are in this key, and spec 11's own answer key blesses that choice (1910.157 governs portable
extinguishers).

**The four gaps on the plan, in the reading's own words** — these are what a correct audit carries:

- Missing contact name or title for plan information and duties
- Missing procedures for employees remaining to operate critical plant operations
- Alarm system signals not ANSI-compliant
- **Plan not reviewed or updated since February 2021**

## MUST

1. **`carry-eap-gaps`** — at least **three of the plan's four gaps** as findings, in the reading's own
   terms. Not re-derived, not renamed: the reading already found them and the audit's job is to carry
   them to an inspector.
2. **`plan-stale`** — the plan as **stale**, **as of February 2021**. The reading's own fourth gap
   says so and the document's date is 2021-02-01.
3. **`forklift-on-file`** — the forklift logs as **on file**, and `06b` as **recorded**.
4. **`alarm-expected`** — alarm **testing or maintenance records** as a **finding against the plan's
   Section 2 condition**, not as an expected item.
   *Changed 29 September as ruled. Run 1 failed this 0/3 in both modes and the failure was the key's:
   it asked for the records under `expected_not_seen`, and alarm testing is **condition 2 of the
   plan** — the four things the reading actually put under `expected_missing` are ICS structure,
   notification/public information, post-incident decontamination, and communicating with responders.
   The key was asking for an expected item the reading never suggested. The check now reads
   `findings`, which is where a condition measured against what is on file belongs.*

### Added by the new fixtures (Run 1b)

Each line names the spec's AUDIT USE section it comes from.

5. **`training-records-on-file`** — the **powered industrial truck training records** answered **on
   file** (09-forklift-training-records.pdf), with **R. Patel stale**: the next evaluation was due
   **2026-05-19** and nothing after 2023-05-19 is recorded. *Spec 09 AUDIT USE.*
6. **`employee-count-contradiction`** — the **42 against 65** contradiction, **naming both
   documents**: 42 as of **2021-02-01** from the emergency plan, now a **confirmed** fact, against 65
   for 2025 from the 300A, still only **proposed**. It belongs in `contradictions`, and the audit must
   say which of the two is confirmed rather than settling the number.
   *Spec 10 AUDIT USE; spec 12 AUDIT USE line C4, which adds that the audit points at Company
   information.* **Reachable for the first time in Run 1b** — see the note at the foot of this file.
7. **`extinguisher-stale`** — the **fire extinguisher certificate** as **stale**, the annual
   maintenance having **expired 2026-08-20**, which is passed at the run date.
   *Spec 11 AUDIT USE; spec 13 AUDIT USE line 5.*

## MUST NOT

1. **`no-new-eap-gap`** — no finding claiming a fault in the plan that the reading did not find. The
   plan was read; inventing a fifth gap is enumerating past the anchor.
2. **`no-deq-permit`** — nothing about the air permit, its conditions, its renewal or its expiry. It
   belongs to the other agency and is on file here as a title only.
3. **`no-satisfied`** — no satisfied, compliant, met, or in compliance.
4. **`no-ai-word`** — the word "AI" appears in no output string.

## ACCEPTABLE

- The supplier SDS named as **not judged** — it carries no agency and its reading reached no verdict.
- The forklift log's three gaps (missing inspection days, horn defect not removed from service,
  supervisor signature missing) carried as findings.
- Training records under `expected_not_seen` — **only while 09 is not on file.** Once it is, the
  answer is must 5 and offering it as merely expected is the weaker answer, not a wrong one.
- **Run 1b:** the six-year maintenance for extinguishers W-3 and L-1, due November 2026, as a date.
- **Run 1b:** the 300A as **on file for 2025** with no finding against it — spec 10's key says the
  form is complete and certified, and a gap on it is a false finding.
- **Run 1b:** case 13, the company's own self-check, named as a **template** or as not judged. Its
  reading produced **8 gaps** against a blank form, which spec 13 calls a false finding; an audit that
  carries those 8 forward is repeating the reading's error, and an audit that leaves them is right.

## ✓ RESOLVED IN RUN 1B: THE 42 IS NOW REACHABLE, AND THE FIX WAS THE FIXTURE, NOT THE CONTRACT

`scripts/run-golden-audit.js` now confirms exactly one fact before any audit runs
(`confirmFixtureFact`): the emergency plan's `employee_count = "42 employees at Portland facility"`,
`as_of 2021-02-01`, `basis read`, `entity_id` the Portland site, `source_document_id` and
`source_proposal_id` set, and the proposal moved to `accepted` — the same columns
`app/api/to-confirm/route.ts` writes at its `company_facts` upsert. **Nothing else is confirmed.** The
300A's `employee_count = "65 (annual average)"` stays `proposed`, which is what makes must 6 a real
test: 42 is a fact, 65 is a question, and the audit must name both without settling which is right.

The audit input now also carries each document's unconfirmed proposals, under a heading that says in
words that nobody has agreed to them, and `prompts/audit-agency.ts` gained one rule to match
("A PROPOSAL IS NOT A FACT"). That is what lets the contradiction be stated at all: before Run 1b the
65 was not in the input either.

**The original note is kept below, because the reasoning in it is still the rule.**

## ⚠ ONE LINE OF THE BRIEF'S KEY WAS NOT REACHABLE IN RUN 1, AND IT WAS NOT A MODEL FAILURE

The brief asked for *"the plan's **42 employees** as stale, as of February 2021"*. **The audit cannot
see 42.** `employee_count = 42 employees` is a **pending `fact_proposals` row**, and
`lib/audit.ts` carries only what a person has **confirmed** — `company_facts` for Cascade is **0 rows**
(read on staging, 29 September). Pending proposals are questions, not facts, and feeding one back as
context is how a model confirms its own guess (`DECISIONS.md` §108, §141).

So the key above asks for the half that IS in the input — the plan is stale, as of February 2021,
which the reading's own gap states — and does **not** score the number. Making the number reachable
means confirming that fact, which is a write to `company_facts` and was out of scope for this run.

**Do not "fix" this by putting pending proposals into the audit input.** The line to change is the
fixture's state, not the function's contract: confirm the fact, then the number appears under
"FACTS FROM THIS DOCUMENT A PERSON HAS CONFIRMED" and this key can ask for it.
