# Golden document 02 — Standard Air Contaminant Discharge Permit, chemical distributor, Oregon

Case id: 02-acdp-chemical
Render as: PDF, 6 pages, agency-letter layout with a DEQ-style header block (use the words "State of Oregon · Department of Environmental Quality" as text, no real logo), numbered conditions.
Company context to scan under: Cascade Specialty Chemicals, LLC · chemical distribution · 4410 NW Front Ave, Portland, Oregon 97210 · one site, "Portland".

No planted gaps. This is the agency's document; the scan should judge nothing in it, and read its dates and conditions. The renewal deadline is defined inside the permit (condition 1.3) so the answer key does not depend on the model knowing Oregon rules.

---

## DOCUMENT TEXT

STATE OF OREGON
DEPARTMENT OF ENVIRONMENTAL QUALITY
Northwest Region · 700 NE Multnomah Street, Suite 600, Portland, Oregon 97232

STANDARD AIR CONTAMINANT DISCHARGE PERMIT
Issued under OAR 340-216

Permit number: 26-2841-ST-01
Permittee: Cascade Specialty Chemicals, LLC
Facility: Cascade Specialty Chemicals, Portland Facility
Facility address: 4410 NW Front Avenue, Portland, Oregon 97210
Source category: Chemical storage and repackaging with vapor control
Date issued: September 1, 2021
Expiration date: November 15, 2026

This permit is issued in accordance with the provisions of ORS 468A.040 and OAR 340-216 and authorizes the permittee to operate the air contaminant sources described below at the facility address, subject to the conditions of this permit.

SECTION 1. GENERAL CONDITIONS

1.1 The permittee shall operate the sources listed in Section 2 in compliance with all conditions of this permit and all applicable rules of the Department.

1.2 This permit expires on November 15, 2026. Operation of the permitted sources after the expiration date without a renewed permit or a timely renewal application is a violation of this permit.

1.3 The permittee shall submit a complete application for renewal of this permit no later than 120 days before the expiration date, that is, on or before July 18, 2026. A permittee that submits a timely and complete renewal application may continue to operate under the terms of this permit until the Department takes final action on the application.

1.4 The permittee shall notify the Department in writing at least 60 days before any change in ownership, and before any modification to a permitted source that would increase emissions of any regulated pollutant.

SECTION 2. PERMITTED SOURCES

2.1 Packed-bed wet scrubber S-1 serving the acid repackaging line (design flow 4,500 scfm).
2.2 Packed-bed wet scrubber S-2 serving the caustic repackaging line (design flow 3,000 scfm).
2.3 Solvent storage tanks T-3, T-4, T-5 and T-6 (each 10,000 gallons, fixed roof, vented to carbon adsorption unit C-1).

SECTION 3. OPERATING AND MONITORING CONDITIONS

3.1 The permittee shall maintain the pressure drop across each scrubber S-1 and S-2 within the range of 2.0 to 6.0 inches of water column whenever the associated line is operating, and shall record the pressure drop reading once per operating day in a scrubber log.

3.2 The permittee shall inspect each scrubber's recirculation pump, spray nozzles, packing and mist eliminator at least once per calendar quarter and record the date, the inspector and any corrective action in the scrubber log.

3.3 The permittee shall replace the carbon in adsorption unit C-1 at least once every 12 months or when breakthrough is detected by the weekly detector-tube check at the C-1 outlet, whichever comes first, and shall record each replacement.

3.4 Visible emissions from any permitted source shall not exceed 20 percent opacity for any period aggregating more than three minutes in any one hour.

SECTION 4. RECORDKEEPING AND REPORTING

4.1 The permittee shall submit an annual report to the Department by February 15 of each year covering the previous calendar year, including total throughput by line, scrubber log summaries, carbon replacement dates and any excess emission events.

4.2 The permittee shall submit a semi-annual monitoring report by July 31 covering January through June of the same year.

4.3 The permittee shall keep all records required by this permit for at least five years from the date of the record and make them available to the Department on request.

SECTION 5. EXCESS EMISSIONS AND UPSETS

5.1 The permittee shall take all reasonable steps to minimize emissions during any period of scrubber malfunction, including stopping the associated repackaging line until the scrubber is returned to service.

5.2 The permittee shall notify the Department by telephone or email within 24 hours of discovering any deviation from a condition of this permit, and shall submit a written report within 15 days describing the deviation, its cause, its duration and the corrective action taken.

SECTION 6. ADMINISTRATIVE

6.1 This permit may be modified, suspended or revoked for cause, including violation of any condition, obtaining the permit by misrepresentation, or a change in any condition that requires reduction of the permitted emissions.

6.2 The permittee shall pay the annual permit fee invoiced by the Department by the due date stated on the invoice.

Signed for the Department,
Regional Air Quality Manager, Northwest Region
September 1, 2021

---

## ANSWER KEY

Run three times. Passes when every "must" holds in all three.

Identity (must):
- kind: permit
- issuer: Oregon DEQ (accept "Oregon Department of Environmental Quality", "DEQ")
- agency includes Oregon DEQ; the label string must be identical across the three runs
- site: Portland
- permit number 26-2841-ST-01 appears in the identity, the summary, or in facts with a verified quote; any of the three passes
- doc_date: issued September 1, 2021; expiry November 15, 2026
- jurisdiction: Oregon; a reference to OAR 340-216 is correct if present

Status (must): if the run date is before November 15, 2026: expiring (within 90 days) or current (before August 17, 2026); after: expired. The runner computes which applies. Never "compliant".

Gaps (must): none. Any gap on a permit is a false finding and fails the run. The summary should say in some words that a permit is the agency's document and what matters is renewal and the conditions.

Deadlines (must contain, with dates):
1. Renewal application due July 18, 2026 (condition 1.3). Flagged as passed if the run date is after it.
2. Permit expiry November 15, 2026 (condition 1.2).
3. Annual report by February 15 each year (condition 4.1), recurring.
4. Semi-annual monitoring report by July 31 (condition 4.2), recurring.
May also contain: quarterly scrubber inspection (3.2), 12-month carbon replacement (3.3), weekly detector-tube check (3.3), annual fee (6.2). Correct if present.

Conditions (must contain at least these, with their condition numbers):
- Scrubber pressure drop 2.0 to 6.0 inches, recorded daily (3.1) — evidence: the scrubber log
- Quarterly scrubber inspection recorded (3.2)
- Carbon replacement at least every 12 months or on breakthrough (3.3)
- 20 percent opacity limit (3.4)
- 24-hour notification and 15-day written report of any deviation (5.2)
- Records kept five years (4.3)

Facts (must contain, quote verified true): the facility address "4410 NW Front Avenue, Portland" (page 1); the permitted sources S-1, S-2, T-3 to T-6 (section 2). Acceptable inferred facts: the company repackages acids and caustics; the company stores solvents.

Freshness: no nudge expected (the document's own date is the issue date; the thing that matters is expiry).

Version match: none in run 1. If the runner has scanned an earlier ACDP for the same company, the scan should propose it as a version; not required for a pass.
