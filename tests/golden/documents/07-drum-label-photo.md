# Golden document 07 — a photograph of a drum label, taken on a phone

Case id: 07-drum-label-photo
Render as: **not rendered.** The fixture is `fixtures/07-drum-label-photo.heic`, a real HEIC of
3024 × 4032 made on the owner's laptop (`sips -s format heic`) from a drawn GHS label. It is the
first golden fixture that is a PHOTOGRAPH rather than a document, and the first in a format the
model API cannot read at all — `lib/imageConvert.ts` converts it to a JPEG first (GAPS-PLAN Part B
step B2, 3 November 2026).
Company context to scan under: Cascade Specialty Chemicals, LLC · chemical distribution ·
Portland, Oregon (the same company as cases 01, 02 and 05).

**Why this case exists.** `docs/VISION-DOCUMENTS.md` §"File types": *"Every supported type has a
fixture in the golden set so a parser change cannot quietly break one."* Until B2 the set had only
rendered PDFs and Word files. A photograph is the type a customer actually sends from a plant
floor, and it is the one with a conversion step in front of it — if that step ever regresses, this
is the case that says so.

**It is the container label for the chemical in case 05.** Case 05 is the supplier's Safety Data
Sheet for Sodium Hydroxide Solution, 50% from Northwest Alkali Products. This is a drum of it on
the rack. They are deliberately the same product, so a reading that confuses a label with an SDS
has somewhere to show it.

## The planted gap

**There is no signal word on the label.** 29 CFR 1910.1200(f)(1)(iii) requires one, and for a
Category 1A skin corrosive it is *DANGER*. Everything else an auditor looks for is present:
product identifier, hazard statements, precautionary statements, supplier identification, and a
pictogram. A reading that names the missing signal word has read the label; a reading that
invents one has not.

---

## WHAT IS ON THE LABEL

SODIUM HYDROXIDE SOLUTION, 50%
CAS No. 1310-73-2

[GHS pictogram: skull and crossbones, in a red diamond]

Hazard statements
H314 Causes severe skin burns and eye damage.
H290 May be corrosive to metals.

Precautionary statements
P280 Wear protective gloves, clothing, eye and face protection.
P303+P361+P353 IF ON SKIN: rinse immediately with water.

Supplier: Northwest Alkali Products, Portland, Oregon
Telephone: 503-555-0142

Batch 2026-114      Filled 12 August 2026

Drum 3 of 6, west bay rack B

---

## NOT ON THE LABEL, AND THE READING MUST NOT SAY IT IS

No signal word. No expiry or review date — "Filled 12 August 2026" is a fill date, not a deadline,
and a reading that turns it into one has invented a compliance date out of a batch record.
