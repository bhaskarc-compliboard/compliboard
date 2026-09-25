# Golden document 06 — Forklift daily inspection log, a record with missing days

Case id: 06-forklift-log-record
Render as: PDF, 2 pages, a landscape table, one row per day, with tick marks, initials and short notes as a warehouse would keep it. Then also render the same content as a photographed page: print page 1, photograph it or rasterise it at a slight angle with uneven lighting, save as a PDF of that image. Two fixtures from one spec: 06a (clean) and 06b (photo).
Company context to scan under: Cascade Specialty Chemicals, LLC · chemical distribution · Portland, Oregon.

Planted findings (do not label them): the truck was in service every weekday in September, and September 2026 begins on a Tuesday; there are no entries for September 3 and 4 (a Thursday and Friday) although the hour meter shows the truck ran; one entry on September 9 notes a defect (horn not working) with no note of the truck being taken out of service or repaired; the last entry is Friday September 18. Every other weekday from the 1st to the 18th has a normal, complete entry, and there are no weekend entries. This is a record: the scan should say what it records, how recent the last entry is, and what is missing, without inventing a program-style gap list.

---

## DOCUMENT TEXT

CASCADE SPECIALTY CHEMICALS, LLC — PORTLAND WAREHOUSE
POWERED INDUSTRIAL TRUCK PRE-SHIFT INSPECTION LOG
Truck: Toyota 8FGU25, unit FL-2, propane · Month: September 2026 · Inspection per OSHA 29 CFR 1910.178(q)(7): examine before each shift; do not use if a defect affects safety.

Checklist items (tick = OK, X = defect, note below): Tires and wheels · Forks, carriage, chains · Mast and hydraulics (no leaks) · Horn · Lights and backup alarm · Seat belt · Brakes and parking brake · Steering · Propane tank secure, no leak · Fire extinguisher present · Data plate legible · Overhead guard

| Date | Shift | Hours | Tires | Forks | Mast | Horn | Lights | Belt | Brakes | Steering | LPG | Ext. | Plate | Guard | Operator | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Sep 1 | Day | 4,812 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M.C. | |
| Sep 2 | Day | 4,819 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M.C. | |
| Sep 7 | Day | 4,834 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | J.R. | |
| Sep 8 | Day | 4,841 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M.C. | |
| Sep 9 | Day | 4,847 | ✓ | ✓ | ✓ | X | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M.C. | Horn not working |
| Sep 10 | Day | 4,853 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | J.R. | |
| Sep 11 | Day | 4,860 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | J.R. | |
| Sep 14 | Day | 4,866 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M.C. | |
| Sep 15 | Day | 4,873 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M.C. | Tank changed |
| Sep 16 | Day | 4,880 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | J.R. | |
| Sep 17 | Day | 4,886 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M.C. | |
| Sep 18 | Day | 4,893 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | J.R. | |

Supervisor review: ____________________  Date: __________
Operators: M.C. = M. Chen (certified 2024-03-11, evaluation due 2027-03-11) · J.R. = J. Rivera (certified 2025-06-02, evaluation due 2028-06-02)

The hour meter rises between Sep 2 (4,819) and Sep 7 (4,834), which shows the truck ran on the missing days.

---

## ANSWER KEY

Run three times on 06a. Run 06b three times as well; its answer key is the same, and if the photo is legible the results should match; if the scan says it could not read 06b, that is an honest answer and passes as could_not_read with a way forward.

Identity (must):
- kind: record
- agency includes OSHA
- subject includes something like "powered industrial trucks" or "forklift" or "worker safety"
- site: Portland (warehouse)
- doc_date: September 2026, kind "last entry" with the date September 18, 2026

Status (must): recorded, with last entry September 18, 2026. Never "compliant". Not gaps_found as a program-style status; but the findings below must appear, as gaps or as notes, whichever the schema uses for records.

Findings (must contain all three, as gaps or notes):
1. No entries for September 3 and 4 while the hour meter shows the truck ran between September 2 and September 7. A finding that also names weekend dates as missing is an over-reach and is reported, not failed. Locator: the table. Citation contains "1910.178(q)(7)" (examined before each shift / at least daily).
2. September 9 records the horn as defective with no note that the truck was removed from service or repaired, and the next day's entry shows the horn OK with nothing recorded in between. Citation contains "1910.178(q)(7)" (not placed in service if a defect affects safety) or "1910.178(p)(1)".
3. The last entry is September 18; if the run date is later than September 21, the scan notes that the log has no entries since and asks whether the truck is still in service or a later page exists.

Findings (must not): no finding that operator certification is missing (both operators are certified with dates); no finding that the checklist is incomplete as a form; no invented finding about maintenance intervals.

Deadlines (must contain): M. Chen operator evaluation due March 11, 2027; J. Rivera evaluation due June 2, 2028 (footer). Citation 1910.178(l)(4)(iii) is correct if given (evaluation at least once every three years).

Facts (must contain, quote verified true): the company operates a Toyota 8FGU25 forklift, unit FL-2, propane (header). Acceptable inferred facts: the company has at least two certified forklift operators (stated in the footer, so read not inferred).

Conditions: none.

Freshness: the last entry is recent; no nudge unless the run date is well past September.
