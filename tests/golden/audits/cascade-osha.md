# cascade-osha — the OSHA audit, Cascade Specialty Chemicals

**Agency label, exactly as it exists on staging:**
`U.S. Department of Labor - Occupational Safety and Health Administration`
*(It was `Oregon OSHA` when this key was written on 29 September. The twelve-document pass the same
afternoon produced this string instead and no `Oregon OSHA` row survives in `company_labels`. The
case file's `agency` had to follow, or `buildAuditInput` matches zero documents — it compares the
label exactly, `lib/audit.ts:123`. **The two strings are NOT merged**, per the brief; this records
that the same regulator has now been named two ways by two passes, and that Oregon is a state-plan
state so the federal DOL string is arguably the wrong one of the two.)*
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

**After the twelve-document pass, NONE of those three is in this audit any more.** The readings of
29 September gave the OSHA label only to **10-osha-300a-2025.pdf**, **11-fire-extinguisher-certificate.pdf**
and **13-company-self-check.docx**. The emergency plan came back with `agencies: []` — no agency at
all — and both forklift logs and the forklift training record came back as `Oregon DEQ`. So musts 1,
2 and 3 below are about documents this audit is no longer shown.

**This key is not rewritten around that, and the failures it produces are the finding.** An audit is
only ever as good as the agency label on a document: a record filed under the wrong regulator is
invisible to the right regulator's audit, and nothing in the audit can tell. The mechanism is
`prompts/document-scan.ts:132-134` — "Reuse these exactly where they fit … Add a new label only when
the document needs one this list does not cover" — read strictly enough that an emergency plan needed
no label and a forklift log was covered by `Oregon DEQ`.

### No fire authority label, so case 11 is scored here

The brief said a `cascade-fire.md` would be written **only if** the readings of 11 carried a fire
authority label. They did not: 11 came back under the OSHA string above, with no
`Portland Fire & Rescue`, `Fire Marshal` or `OSFM` anywhere in `company_labels`. So case 11's audit
lines are in this key, as the brief directed for that outcome. Spec 11's own key blesses OSHA as one
of the two acceptable choices (1910.157 governs portable extinguishers).

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
