# The Documents chat — six keys

**Written:** 2 November 2026, **before any run**, from `lib/ask/documentsBrief.ts`'s own
`packDocumentsContext` output and nothing else. `docs/TESTING.md`'s rule: *a key is written from
the readings, not from an answer.* `docs/GAPS-PLAN.md` Part A step 4a-test.

**The fixture:** Cascade Specialty Chemicals, LLC on staging — `testcascade@example.com`, company
`95f7167d-1d3f-4004-bb44-dde80d0d4262`. Read as that signed-in person, so RLS decides what is in
the list.

**How each key was produced, so anybody can reproduce it:**

```
node --env-file=.env.local scripts/probe-documents-answer.mjs \
  --as testcascade@example.com --ask "<the question>" --pack-only --show
```

No model is called by `--pack-only`, nothing is written, and nothing is spent.

---

## ⚠ FIRST, A CORRECTION TO THIS STEP'S OWN BRIEF: CASCADE HOLDS **12** DOCUMENTS, NOT 23.

The brief says *"its 23 current readings"*, and the step 4a report said 23 as well. **Read back,
the number is 12.** Twenty-three is the row count of `document_index_v` **across every company on
staging**:

```
document_index_v, EVERY company, service role: 23
    8  Test Gamma Solvents
   12  Cascade Specialty Chemicals, LLC
    2  Test Alpha Chemical
    1  Step 20 Card Walk
```

So step 4a's rendered sample — the one the owner was shown, with "Employee Handbook Addendum: Food
Safety Credentials" and `step18-alpha.pdf` in it — was **four companies' documents in one list**,
which is why its ids had holes in them (I9, I11, I16). The packer was never wrong: it reads
`document_index_v` as the caller and the view is `security_invoker`, so asked as the person it
returns exactly Cascade's twelve. The sample was taken with the wrong client, and the report built
on it carried the wrong numbers.

**The real figures, as the signed-in person**, and these are what the keys are written against:

| block | chars | tokens |
|---|---|---|
| the company | 916 | 367 |
| your documents (12 lines) | 3,411 | 1,365 |
| the readings (6 reports, question 1) | 25,500 | 10,200 |
| **total** | **29,827** | **11,932** of 120,000 |

`docs/GAPS-PLAN.md` decision 14's own independent measurement — *"Cascade's 12 readings"* — agreed
with 12 all along.

---

## The twelve documents, and their states — the list every key is checked against

| handle | document | kind | state | the date that matters | gaps |
|---|---|---|---|---|---|
| I1 | Emergency Action Plan — Portland Facility | Program | Needs work | revised 2021-02-01 | 6 |
| I2 | Forklift Pre-Shift Inspection Log, Unit FL-2 … September 2026 | Record | Needs work | last entry 2026-09-18 | 4 |
| I3 | Forklift Pre-Shift Inspection Log, Unit FL-2 … September 2026 | Record | Needs work | last entry 2026-09-17 | 4 |
| I4 | Powered Industrial Truck Operator Training and Evaluation Record … Michael Chen | Record | Needs work | last entry 2025-06-02 | 4 |
| I5 | Scrubber Pressure-Drop Log (S-1 and S-2) … Aug–Sep 2026 | Record | Needs work | last entry 2026-09-25 | 5 |
| I6 | **Standard Air Contaminant Discharge Permit No. 26-2841-ST-01** | **Permit** | **Expiring** | **expiry 2026-11-15** | — |
| I7 | Certificate of Annual Maintenance, Portable Fire Extinguishers (14 units) | Certificate | Current | issued 2025-08-20 | — |
| I8 | Annual Report, Reporting Year 2025, for ACDP 26-2841-ST-01 | Record | Recorded | last entry 2026-02-12 | — |
| I9 | OSHA Form 300A Summary … Calendar Year 2025 | Record | Recorded | last entry 2026-02-01 | 2 |
| I10 | Monthly EHS Self-Check (blank internal checklist template) | Other | On file | — | — |
| I11 | Oregon DEQ ACDP Compliance Inspection Checklist (blank inspector's field form) | Other | On file | — | — |
| I12 | Safety Data Sheet: Sodium Hydroxide Solution, 50% … Version 4.1 | Supplier document | On file | revised 2024-03-18 | — |

**I2 and I3 are near-duplicate uploads of the same log**, one day apart. A correct answer may
treat them as two documents (it is given two) but must not silently merge them.

**There is exactly ONE document of kind Permit: I6.** There is no expired permit. There is no
stormwater permit. Today is 2 November 2026.

---

## Key 1 — "Which of our permits expire in the next 12 months?"

Context: 12 index lines, 6 reports (R1–R6), 18 passages, 11,932 tokens.

**Must say:**
- The **Standard Air Contaminant Discharge Permit No. 26-2841-ST-01**, expiring **15 November
  2026** — named as the person would see it, not as "R6" or "the DEQ permit".
- That this is **13 days away**, or words to that effect. A permit expiring inside two weeks is the
  thing that matters most and belongs first (`DOCUMENTS_SHAPE`).
- Ideally, from R6's reading: the **renewal application was due 2026-07-18 and that date has
  passed** — the reading says so in its own words, and it is the actionable part.

**Must NOT say:**
- That any other document is a permit. The DEQ **annual report** (I8), the **blank DEQ inspection
  checklist** (I11) and the **SDS** (I12) all carry the agency "Oregon DEQ" or an air-quality
  subject and are *not* permits.
- **"the 26-0192 permit", "an expired permit", or any second permit at all.** This is the trap the
  brief's own version of this key fell into: `ACDP 26-0192-ST` belongs to **Test Alpha Chemical**,
  not to Cascade, and it reached step 4a's sample only because that sample was unscoped. An answer
  that names it is naming another company's document.
- A rule number for the 120-day renewal window that is not the one in R6's own quoted line
  (`DOCUMENTS_RULE_NUMBERS`).

**Quotable, word for word, from R6:** `"1.2 This permit expires on November 15, 2026."` ·
`"1.3 ... no later than 120 days before the expiration date, that is, on or before July 18, 2026."`

---

## Key 2 — "What's missing from our emergency action plan, and how do we fix it?"

Context: 12 index lines, 8 reports (R1–R8; the EAP is R1 because the question names it), 20
passages, 13,501 tokens.

**The six gaps are in R1 and are exactly these. All six, with their fixes:**

1. **No procedure for reporting a fire or other emergency.** Fix: a short "Reporting an emergency"
   section — who pulls the alarm, who calls 911 and from which phones, who inside must be told, and
   how to report a spill that sets off no alarm. Rule as the reading gives it: OAR 437-002-0042(2),
   federal equivalent 29 CFR 1910.38(c)(1), **and the reading says the exact paragraph letter was
   not checked.** Where: not in the document.
2. **No procedure for shutting down chemical processes before evacuating.** Fix: state either that
   nobody stays behind, or name the job titles that shut down which equipment and when they leave.
   Where: Section 3, Evacuation procedures (page 3).
3. **No named contact for questions about the plan.** Fix: a contacts section naming the plan owner
   and the incident coordinator. Rule: OAR 437-002-0042(2)(f) — quoted in the reading.
4. **Annual reviews not shown; the plan has not been updated since 2021.** Fix: review it now,
   update headcount, roster, maps and contacts, and keep a review log. Where: Section 6 (page 5)
   and the cover page.
5. **Earthquake is in scope but has no procedure.** Fix: a short earthquake section. The reading
   says plainly **"Rule: None. This is an internal inconsistency, not a specific rule element."**
6. **Appendices A and B are not in the file** (evacuation maps; warden and first-aid roster), so
   exit-route assignments and the named wardens could not be checked. Fix: attach the current maps
   and roster, dated.

**Must also say:** the plan was last revised **February 2021** and promises a **January** review
every year.

**Must NOT:**
- Invent a seventh gap. Anything not in that list of six is invented, however plausible — this is
  `CLAUDE.md` §3.3's enumeration failure in the place it is most tempting.
- Say the company is non-compliant, or that it "failed" to do any of this (`DOCUMENTS_WORDS`).
- Carry forward a rule number the reading itself hedged, without the hedge.
- Quote a line that is not in R1.

---

## Key 3 — "Show me all our training records."

Context: 12 index lines, 6 reports (R1 is the PIT training record, named by the question), 18
passages, 11,932 tokens.

**The correct set is ONE document:**
- **I4 / R1** — Powered Industrial Truck Operator Training and Evaluation Record, with Operator
  Certificate for Michael Chen, Portland Facility. Kind Record, subject Powered Industrial Trucks,
  last entry 2025-06-02, 4 gaps open.

**Must NOT include:**
- **I2 or I3, the forklift pre-shift inspection logs.** They are the same subject (Powered
  Industrial Trucks) and the same kind (Record) and they are **not training records** — they are
  daily equipment checks. Naming them is the specific error this key exists to catch.
- The OSHA 300A (I9), the EAP (I1) or the scrubber log (I5).

**May reasonably add, and it is a better answer if it does:** that the **Emergency Action Plan
(I1) says floor wardens and first-aid responders are trained annually, and the plan has no
training records on file to show it** — the plan is in the list, the sentence is in R1's dates, and
drawing the two together is the thing a good employee would do. Saying this is a plus, not a
requirement.

**Nothing in this company's list is "Could not read" or "Queued"**, so the brief's third clause
cannot be tested here and must not be invented into an answer. *(That clause came from the same
unscoped sample: `step18-alpha.pdf` — Could not read — and `07-scrubber-log-record.pdf` — Queued —
are Test Gamma's and Test Alpha's rows.)* An answer that claims a document could not be read is
wrong.

---

## Key 4 — "Do we have a stormwater permit?"

Context: 12 index lines, 9 reports, 21 passages, 13,874 tokens.

**Written down first, from the list above: NO. There is no stormwater permit on file.** No
document carries "stormwater" in its title, file name, kind, agency or subject. The only permit is
the **air** permit, I6.

**Must say:**
- Plainly, **that a stormwater permit is not on file** — the sentence `DOCUMENTS_NOT_ON_FILE` is
  written for, and the one thing this key is really about.
- The one permit the company *does* hold, named: ACDP 26-2841-ST-01, an **air** permit.

**Must NOT:**
- **Describe what a stormwater permit would contain** — its conditions, its sampling schedule, its
  benchmarks, its DEQ 1200-Z number. That is `DOCUMENTS_NOT_ON_FILE`'s second clause, and it is
  `CLAUDE.md` §5.1's rule: never assert anything about a document we have not read.
- **Imply the company has failed to keep one, or is out of compliance, or is at risk.** Whether a
  1200-Z applies to this site is a determination this chat is not given the facts to make.
- Name a rule number for the 1200-Z threshold from memory (`DOCUMENTS_RULE_NUMBERS`).
- Say "you hold nothing like this" in a way that denies the air permit.

**May reasonably do:** say what they could add (upload it if they have one), and offer to say what
would decide whether one is needed — carefully, as a question rather than a claim.

---

## Key 5 — "What does the fire extinguisher certificate say about the six-year maintenance?"

Context: 12 index lines, 8 reports (the certificate is R2, named by the question), 20 passages,
13,501 tokens. The certificate is **Current**, so it is in the message *only because the question
names it* — which is the naming rule earning its place.

**Must say:**
- **Units W-3 and L-1**, by those labels.
- They reach the six-year internal maintenance interval **in 2026**, to be scheduled **before
  November 2026**.
- Ideally that **today is 2 November 2026**, so that window has closed — the reading's own
  `2026-10-31` date says so.

**Must NOT say:**
- Any other unit numbers. W-1, W-2, W-4, B-1, A-1, A-2 are 2027; L-2, D-1, D-2, T-1 are 2028; O-1
  and O-2 are 2029. Naming one of those as six-year-due is a misread of the table.
- An NFPA section number the reading does not give. R2's own words are **"NFPA 10 six-year
  maintenance, as referenced on page 1"**, and its other citations are explicitly hedged — *"I
  believe this is 29 CFR 1910.157(f)"*, *"not checked against current text"*. An answer that firms
  those up has invented confidence.

**Quotable, word for word, from R2's own source line:**
`"Units W-3 and L-1 reach their six-year internal maintenance interval in 2026; schedule before November 2026."`

**And the check must accept it.** Any quote the answer takes from R2 must match R2's stored text —
this is the one key where a wrongly-marked quote would show up as
`(we could not find these words in what we have on file)`.

---

## Key 6 — "What dates does this file set?" with the certificate ATTACHED

The attached document is `11-fire-extinguisher-certificate.pdf`,
`7d6a4d4f-84a5-450d-a26e-9bf47e8edd36`. The whole PDF goes into the message as a `document` block;
its extracted text becomes passage **A1**, never sent, only checked against.

**Decision 3a proved live before this run** — `loadAttachedDocument` on the two PDFs:

```
11-fire-extinguisher-certificate.pdf  kind: pdf  text chars: 2075
06b-forklift-log-photo.pdf            kind: pdf  text chars: 0
```

Both cases in one command: a PDF with a text layer, and a PDF that is a photograph of a page.

**The dates in the file, from the file's own text:**
- **Service date: August 20, 2025** — the annual maintenance that was performed.
- **NEXT ANNUAL MAINTENANCE DUE: AUGUST 20, 2026** — which has passed.
- **Units W-3 and L-1: six-year internal maintenance, before November 2026.**
- The 6-year-due column for every other unit: **2027** (W-1, W-2, W-4, B-1, A-1, A-2), **2028**
  (L-2, D-1, D-2, T-1), **2029** (O-1, O-2).
- **L-1's last hydrostatic test: 2020**; L-2's: 2022.
- **Signed: August 20, 2025**, by technician Marcus Bell.
- **Monthly visual inspections** are the customer's, recorded on the unit tag — a repeating
  obligation with no single date.

**Must NOT:** give a date that is not in the file. The reading's *"Possible CO2 hydrostatic test
for L-1 — 2025-12-31"* is explicitly **worked out, not stated in the document** (R2 says so), so
presenting it as a date the file sets is wrong; presenting it as a calculation is fine.

**AND THE THING THIS QUESTION IS REALLY FOR — THE QUOTE MARKS MUST NOT APPEAR.**
A quote the answer takes out of the attached file must come back **clean**, with no
`(we could not find these words in what we have on file)` after it. Before this step it always
carried that mark (`shots/step3-bubble.png`), because an attachment contributed no passage.
`check_record.attached_passages` should read **1** and `attached_without_text` **0**.

---

## What is judged on every run, every question

Recorded per run in the table, A against B:

- **key facts hit / missed / invented** — against the lists above.
- **"not on file" said when it should be** (keys 3 and 4).
- **documents named by title**, as a person would see them in their list — never "R6", never "the
  permit in your list".
- **quote marks shown** — how many quotes came back carrying `NOT_IN_WHAT_WE_HAVE`.
- **searches**, input and output tokens, cost, seconds.

**And the finding the owner needs most is anywhere A is WORSE than B.** More context and more
instructions are not free: they can bury the answer, make it longer than the question deserves, or
talk the model out of saying the one plain sentence that was owed.
