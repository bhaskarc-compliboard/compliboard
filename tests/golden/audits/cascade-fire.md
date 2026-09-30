# cascade-fire — Oregon State Fire Marshal, Cascade Specialty Chemicals

**Agency label, exactly as it exists on staging:** `Oregon State Fire Marshal`
**Company:** Cascade Specialty Chemicals, LLC · Portland, Oregon
**Run date the key is written for:** 2026-09-29

## Why this file exists now, and did not before

The standing condition was: **a `cascade-fire.md` exists only if a fire authority label exists.**
Through Runs 1b and 1c it did not. Case 11 was filed under the federal DOL string by Haiku and under
`Oregon OSHA` by the first real-model pass, so its lines were scored under `cascade-osha.md`, which
says so.

The second real-model pass — the same model, `claude-opus-5-5`, re-reading the same twelve fixtures
after migration 058's from-zero reset — labelled case 11
`["Oregon OSHA", "Oregon State Fire Marshal"]`. So the condition is met and this key exists.

**That is worth recording for its own sake: the same model, same prompt, same document, produced a
different agency set on two passes hours apart.** Cascade now holds four agency labels where the
earlier pass gave it two — `Oregon State Fire Marshal` and `U.S. OSHA` are both new, and `U.S. OSHA`
sits beside `Oregon OSHA` on the 300A, which is the same regulator named twice for one document. No
label was corrected: `correctFixtureLabels` checks each document against its own spec's accepted
strings, and spec 11 accepts a fire authority OR OSHA, so both labels satisfy it.

## What the audit is given

One document carries this label: **11-fire-extinguisher-certificate.pdf**, read as a `certificate`,
status `expired`, 0 open gaps, 5 deadlines. Eleven other documents are on file as titles only.

**The zero matters**, as it does for the DEQ permit: the certificate's own reading found nothing wrong
with the certificate, so every finding in a correct audit comes from the DATES on it measured against
today, not from a gap somebody else already wrote.

## MUST

1. **`extinguisher-stale`** — the annual maintenance as **stale**: certified **2025-08-20**, next due
   **2026-08-20**, **passed**, nothing on file since. *Spec 11 AUDIT USE, line 1.*
2. **`six-year-nothing`** — six-year maintenance for **W-3 and L-1**, due **November 2026**:
   **nothing on file**. *Spec 11 AUDIT USE, line 2.*
3. **`monthly-not-a-document-question`** — monthly visual inspections as a
   **not-a-document question**, or as nothing on file: the certificate says they are recorded on the
   unit tags, so no document here can settle them. *Spec 11 AUDIT USE, line 3.*

## MUST NOT

1. **`no-satisfied`** — no finding worded satisfied, compliant, met, or in compliance.
2. **`no-invented-document`** — no handle the block did not carry, and no id that was not given.
3. **`no-deq-permit`** — nothing about the air permit. It belongs to another agency and is on file
   here as a title only.
4. **`no-ai-word`** — the word "AI" appears in no output string.

## ACCEPTABLE

- The hydrostatic test dates for the CO2 and water units as dates.
- The 14 units, and the service company's licence, as facts carried from the reading.
- The certificate named `on_file` as well as `stale`; both are true of it and the words are not
  exclusive.

## One thing this case cannot test yet

Spec 11's fourth AUDIT USE line — *"this document makes a third agency group on the Audits page"* — is
about a page that does not exist. It is recorded here so it is not lost, and it is not a check.
